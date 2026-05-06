import type { PrismaClient } from '@prisma/client';
import type { ClaimResult, PendingItem, UserId } from './types';

/**
 * Claim the next unclaimed review item for a reviewer.
 *
 * Returns `{ kind: 'claimed', item }` when an item was claimed,
 * or `{ kind: 'empty' }` when the queue has nothing pending.
 *
 * The caller is responsible for separation-of-duties filtering
 * (i.e. callers that must not claim their own items should filter
 * beforehand in their service layer).
 */
export async function claimNextItem(
  prisma: PrismaClient,
  reviewer: UserId
): Promise<ClaimResult> {
  // Single transaction so the row-level lock taken by SELECT ... FOR UPDATE
  // SKIP LOCKED is held until the matching UPDATE commits. SKIP LOCKED makes
  // concurrent claimers pick distinct rows instead of contending on the same
  // one, closing the read-modify-write race the original two-step had.
  return prisma.$transaction(async (tx): Promise<ClaimResult> => {
    const candidates = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "ReviewQueueItem"
      WHERE "status" = 'PENDING' AND "claimedBy" IS NULL
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    if (candidates.length === 0) {
      return { kind: 'empty' };
    }

    const updated = await tx.reviewQueueItem.update({
      where: { id: candidates[0].id },
      data: {
        status: 'UNDER_REVIEW',
        claimedBy: reviewer,
        claimedAt: new Date(),
      },
    });

    return { kind: 'claimed', item: updated as unknown as PendingItem };
  });
}
