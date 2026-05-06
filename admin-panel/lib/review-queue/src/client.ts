import type { PrismaClient } from '@prisma/client';
import { listPending } from './list-pending';
import { claimNextItem } from './claim';
import { approve } from './approve';
import { reject } from './reject';
import type { ReviewQueueClient } from './types';

/**
 * Create a review-queue client bound to a Prisma client instance.
 *
 * Example:
 *   const queue = createReviewQueueClient(prisma);
 *   const result = await queue.claimNextItem(currentUser.id);
 */
export function createReviewQueueClient(
  prisma: PrismaClient
): ReviewQueueClient {
  return {
    listPending: (filter) => listPending(prisma, filter),
    claimNextItem: (reviewer) => claimNextItem(prisma, reviewer),
    approve: (itemId, reviewer, note) =>
      approve(prisma, itemId, reviewer, note),
    reject: (itemId, reviewer, reason) =>
      reject(prisma, itemId, reviewer, reason),
  };
}
