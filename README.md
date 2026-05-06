# Node.js / Next.js Level 1 Assessment

Admin-panel feature set on Next.js App Router with Prisma, PostgreSQL, Zod, Vitest, and RBAC.

## Run

```bash
cd admin-panel && cp .env.example .env && npx prisma migrate dev && npm run dev
```

## Routes (after `npm run dev`)

- http://localhost:3000/admin — redirects to `/admin/announcements`
- http://localhost:3000/admin/announcements — list (non-deleted, paginated)
- http://localhost:3000/admin/announcements/new — bilingual create form
- http://localhost:3000/admin/announcements/[id]/edit — edit + soft-delete
- http://localhost:3000/admin/users — user lookup (SUPPORT: 4 cols, ADMIN: 7)
- http://localhost:3000/api/health — `{ status: "ok" }`
- http://localhost:3000/api/health?include=latest — latest announcement or `{ latest: null }`
- http://localhost:3000/api/announcements — `POST` create
- http://localhost:3000/api/announcements/[id] — `PATCH` / `DELETE`
- http://localhost:3000/api/users — `GET` with `?q=&page=&pageSize=`

## Level 2 — Review workflow, verification, race fix

Level 2 layers a multi-tier review workflow, an external verification adapter, and an in-place race fix on the seeded `@assessment/review-queue` library.

### Run (Level 2)

```bash
cd admin-panel && npm install
# Create .env (see "Environment variables" below) — DATABASE_URL + MOCK_USER_*
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run db:seed
npm run dev
```

`db:seed` upserts four users:

- `admin@example.com` (ADMIN)
- `cm@example.com` (CONTENT_MANAGER)
- `compliance@example.com` (COMPLIANCE_OFFICER) — **new in Level 2**
- `support@example.com` (SUPPORT)

Switch the active session by editing `MOCK_USER_ROLE` (and `MOCK_USER_ID` / `MOCK_USER_EMAIL` / `MOCK_USER_NAME`) in `.env`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Required for the app, the seed, and the concurrent-claim integration test. |
| `MOCK_USER_ID` / `MOCK_USER_EMAIL` / `MOCK_USER_NAME` / `MOCK_USER_ROLE` | Mock session — Level 1 pattern. `MOCK_USER_ROLE` controls what the UI/RBAC sees. |

### New routes

- `POST /api/announcements/[id]/submit-for-review` — ADMIN / CONTENT_MANAGER. Moves a `DRAFT` announcement to `PENDING_REVIEW` and creates a `ReviewQueueItem` (tier 1).
- `GET /api/review-queue` — ADMIN / COMPLIANCE_OFFICER. Lists pending items the caller is allowed to claim (excludes self-authored).
- `POST /api/review-queue/claim` — ADMIN / COMPLIANCE_OFFICER. Claims the next non-self-authored pending item (`SELECT … FOR UPDATE SKIP LOCKED`). Returns `{ kind: 'claimed', item }` or `{ kind: 'empty' }`.
- `POST /api/review-queue/[id]/approve` — body `{ note }`. Runs the verification adapter inside a single transaction: APPROVED → announcement `PUBLISHED`; REJECTED → announcement back to `DRAFT`; transport / breaker error → tx rolls back, best-effort `VERIFICATION_TRANSPORT_FAILED` audit, 503 to caller.
- `POST /api/review-queue/[id]/reject` — body `{ reason }`. Item → `REJECTED`, announcement → `DRAFT`, audit + notification stub.
- `POST /api/review-queue/escalate` — ADMIN. Bumps `tier` to 2 and stamps `escalatedAt` for unclaimed `PENDING` items older than 48h. Returns `{ escalated: count }`. There is no cron — call this from an external scheduler.

### Verification adapter

`admin-panel/lib/adapters/verification/` ships:

- `MockVerificationAdapter` — used in dev. APPROVES by default; **rejects when `bodyEn` or `bodyAr` contains the literal token `__deny__`**. The approve route wires this in by default, so you can deny end-to-end without any extra config.
- `LiveVerificationAdapter` — scaffold only. Every wire-touching site is annotated `// TODO SPEC PENDING`. `verify()` throws `Error('TODO SPEC PENDING')`.
- `CachedRetryingBreakerAdapter` — wraps any inner adapter with:
  - **Cache** keyed by `announcementId + sha256(titleEn|titleAr|bodyEn|bodyAr).slice(0,16)`. APPROVED entries expire after 5 min; REJECTED entries are sticky (only an explicit body edit invalidates them). Precedence: cached REJECTED beats fresh APPROVED.
  - **Retry**: 3 attempts, exponential backoff 100/200/400 ms with ±20 % jitter. Only `TransientVerificationError` is retried; `PermanentVerificationError` (e.g. 4xx) fails fast.
  - **Breaker**: CLOSED → 5 consecutive failures → OPEN → 30 s → HALF_OPEN → 1 success → CLOSED, 1 failure → OPEN. While OPEN, callers receive `TransientVerificationError('breaker open')` without ever touching the inner adapter.

### Tests

```bash
npm test              # all suites; the race test only runs when DATABASE_URL is set
DATABASE_URL=… npm test
```

- `__tests__/announcements.test.ts` — Level 1 RBAC + create/edit/delete (carry-over).
- `__tests__/health-bug.test.ts`, `__tests__/users-privacy.test.ts` — Level 1 carry-overs.
- `__tests__/review-queue-claim-race.test.ts` — **Postgres integration test for Part C**. Seeds one PENDING row, then has 5 concurrent `claimNextItem` callers race on 5 separate `PrismaClient` instances. Asserts exactly one wins and four get `{ kind: 'empty' }`. **Requires `DATABASE_URL`** — the file uses `describe.skipIf(!HAS_DB)` so without a database the suite is skipped (pure mocks cannot reproduce row-level lock semantics).
- `__tests__/verification-precedence.test.ts` — cached REJECTED is sticky; an edited body is treated as a new key and accepts a fresh APPROVED.
- `__tests__/verification-breaker.test.ts` — uses an injectable `Clock` to advance time. Verifies the breaker trips after 5 failures, short-circuits while OPEN, and recovers on HALF_OPEN probe success.
- `__tests__/workflow-separation-of-duties.test.ts` — the author cannot claim or approve their own item; on a SKIP LOCKED race the row is released back to `PENDING`.
- `__tests__/workflow-transactional.test.ts` — when an audit write or the verification call throws, the workflow transaction rolls back (no committed writes) and the best-effort `VERIFICATION_TRANSPORT_FAILED` audit is written outside the failed tx.

### Part C — race fix

The seeded `claimNextItem` did `findFirst` then `update`, leaving a TOCTOU window where two reviewers could both see and update the same row. Fix: a single `prisma.$transaction` runs `SELECT id … FOR UPDATE SKIP LOCKED LIMIT 1` followed by `update`. The Postgres row-level lock is held across processes and connection pools, and `SKIP LOCKED` makes concurrent claimers pick distinct rows. See `admin-panel/lib/review-queue/src/claim.ts` and the integration test above for repro + assertion.
