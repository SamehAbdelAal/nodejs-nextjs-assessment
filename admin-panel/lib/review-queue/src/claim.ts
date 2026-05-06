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
  const candidate = await prisma.reviewQueueItem.findFirst({
    where: {
      status: 'PENDING',
      claimedBy: null,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (!candidate) {
    return { kind: 'empty' };
  }

  const updated = await prisma.reviewQueueItem.update({
    where: { id: candidate.id },
    data: {
      status: 'UNDER_REVIEW',
      claimedBy: reviewer,
      claimedAt: new Date(),
    },
  });

  return { kind: 'claimed', item: updated as unknown as PendingItem };
}
