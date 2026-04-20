# POSTMORTEM — Part B

## What went wrong

`GET /api/health?include=latest` returned **HTTP 500** whenever the
`Announcement` table was empty or every row was soft-deleted. The handler
destructured the result of `prisma.announcement.findFirst(...)` without
checking whether the query matched any row:

```ts
const latest = await prisma.announcement.findFirst({
  where: { deletedAt: null },
  orderBy: { createdAt: "desc" },
});
// silenced by `!` — latest may be null at runtime
const { id, titleEn, titleAr, createdAt } = latest!;
```

Prisma's `findFirst` is typed `T | null`. The non-null assertion (`!`) made
the compiler accept the code, but did not change the runtime value. When no
non-deleted row existed, `latest` was `null`, and destructuring threw:

```
TypeError: Cannot destructure property 'id' of 'null' as it is null.
```

Next.js surfaces uncaught exceptions from route handlers as a generic 500
response.

## Why it was intermittent

The failure is deterministic given the database state but sporadic in
practice. In a live environment with continuously created content, `latest`
is almost always non-null, so the endpoint appears healthy. The 500
re-appears whenever:

- the database is freshly migrated (empty table);
- test suites run against an empty or reset database;
- every announcement has been soft-deleted (possible after bulk cleanup);
- a staging/dev DB is reset and health checks fire before the first record.

Because these states are short-lived in production, the bug reads as a
transient glitch rather than a reproducible defect.

## How to reproduce

1. Reset the database and re-migrate:
   ```bash
   cd admin-panel
   npx prisma migrate reset --force
   ```
2. Start the server:
   ```bash
   npm run dev
   ```
3. Hit the endpoint with the trigger query parameter:
   ```bash
   curl -i 'http://localhost:3000/api/health?include=latest'
   ```
4. Observe: `HTTP/1.1 500 Internal Server Error`. The dev-server log prints
   `TypeError: Cannot destructure property 'id' of 'null' as it is null` at
   `app/api/health/route.ts`.

Alternate path (non-empty DB): soft-delete every row, then repeat step 3:

```sql
UPDATE "Announcement" SET "deletedAt" = NOW();
```

## Root cause

The `!` non-null assertion was used as a way to *quiet the compiler* rather
than to encode a runtime invariant that actually held. `findFirst` has no
such invariant — the "no matching row" case is the primary reason its return
type is nullable. The assertion hid the possibility at build time while
leaving it unchanged at runtime, producing a silent footgun that only
tripped under a narrow database state.

## How recurrence is prevented

1. **Guard before destructuring.** The handler checks `if (!latest)` and
   returns `{ status: "ok", latest: null }` — an empty table is a normal
   response, not an error.
2. **Removed the non-null assertion.** `admin-panel/tsconfig.json` already
   enables `"strict": true`. Without the `!`, the compiler refuses to
   destructure a `T | null` value directly, which would have caught the
   original bug at build time. Any future handler that destructures a
   `findFirst` result is forced to narrow the type first.
3. **Regression test.** A test hits `GET /api/health?include=latest`
   against an empty database and asserts the response is `200` with
   `body.latest === null`. The test fails on the original code (500) and
   passes on the fix, so re-introducing a null-unsafe destructure will
   break CI.
