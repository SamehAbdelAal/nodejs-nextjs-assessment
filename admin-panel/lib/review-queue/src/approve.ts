import type { PrismaClient } from '@prisma/client';
import type { ItemId, UserId } from './types';

/**
 * Approve a previously claimed review item.
 *
 * Runs inside a transaction so the status change and decision metadata
 * stay consistent with any downstream effects the caller layers on top
 * (audit entry, notification, publish step).
 *
 * Throws if the item does not exist, was not claimed by `reviewer`, or
 * is not currently in the `UNDER_REVIEW` state.
 */
export async function approve(
  prisma: PrismaClient,
  itemId: ItemId,
  reviewer: UserId,
  note: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await tx.reviewQueueItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new Error(`review item ${itemId} not found`);
    }
    if (item.claimedBy !== reviewer) {
      throw new Error(
        `only the claiming reviewer may approve this item`
      );
    }
    if (item.status !== 'UNDER_REVIEW') {
      throw new Error(
        `cannot approve an item in status ${item.status}`
      );
    }

    await tx.reviewQueueItem.update({
      where: { id: itemId },
      data: {
        status: 'APPROVED',
        decisionNote: note,
        decidedAt: new Date(),
      },
    });
  });
}
