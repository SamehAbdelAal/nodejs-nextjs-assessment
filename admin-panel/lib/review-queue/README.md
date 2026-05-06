# @assessment/review-queue

Small TypeScript library that provides the review-queue primitive for the Level 2 assessment: list pending items, claim the next one for a reviewer, approve a claimed item, reject a claimed item.

## Install

This is a local package delivered as part of the Level 2 assessment. After you check out the starting branch for Level 2, apply the patch the hiring team gave you:

```bash
git apply review-queue.patch
git add lib/review-queue
git commit -m "install seeded review-queue"
```

The library lives at `lib/review-queue/` and is consumed as a local path import from your workflow layer.

## Prisma schema prerequisite

The library operates on a `ReviewQueueItem` Prisma model. You must add the following model to your `prisma/schema.prisma` and run a migration before the library will compile or run:

```prisma
model ReviewQueueItem {
  id             String    @id @default(cuid())
  announcementId String    @unique
  authorId       String
  status         String    // PENDING | UNDER_REVIEW | APPROVED | REJECTED
  claimedBy      String?
  claimedAt      DateTime?
  decisionNote   String?
  decidedAt      DateTime?
  createdAt      DateTime  @default(now())

  announcement Announcement @relation(fields: [announcementId], references: [id])

  @@index([status, claimedBy])
  @@index([createdAt])
}
```

Run `npx prisma migrate dev --name add-review-queue-item` after adding the model so the Prisma client picks up the new table. The library will not type-check until `prisma generate` has produced a `ReviewQueueItem` accessor on the Prisma client.

## Usage

```ts
import { createReviewQueueClient } from 'lib/review-queue/src';
import { prisma } from './prisma';

const queue = createReviewQueueClient(prisma);

// list pending items a reviewer is allowed to claim
const items = await queue.listPending({
  excludeAuthorId: currentUser.id,
  limit: 20,
});

// claim the next one atomically
const result = await queue.claimNextItem(currentUser.id);
if (result.kind === 'claimed') {
  // hand the claimed item to your workflow
}

// later, approve or reject the claimed item
await queue.approve(result.item.id, currentUser.id, 'looks good');
// or
await queue.reject(result.item.id, currentUser.id, 'missing citation');
```

## Public API

| Method | Purpose |
|---|---|
| `listPending(filter)` | List items awaiting review, filtered by status and optionally excluding a specific author. |
| `claimNextItem(reviewer)` | Claim the next unclaimed PENDING item for a reviewer. Returns `{ kind: 'claimed', item }` on success or `{ kind: 'empty' }` when the queue has nothing. |
| `approve(itemId, reviewer, note)` | Approve a previously claimed item. Only the claiming reviewer may approve. |
| `reject(itemId, reviewer, reason)` | Reject a previously claimed item. Only the claiming reviewer may reject. |

## Known issue

Under concurrent load, two reviewers clicking "claim next" at the exact same moment may both end up with the same review item assigned to them. Functional tests pass. The separation-of-duties audit catches the inconsistency later and flags the resulting state as invalid.

This is a known bug. As part of the Level 2 assessment, you must:

1. Reproduce the bug with a concurrent test.
2. Find the root cause inside `lib/review-queue/`.
3. Fix it in place. Do not rewrite the library.
4. Prove the fix with a test that fails on the original and passes on your fix.

See the Level 2 assessment page for the full debugging task and submission rules.
