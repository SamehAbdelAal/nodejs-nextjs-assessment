import type { PrismaClient } from '@prisma/client';
import type { PendingFilter, PendingItem } from './types';

/**
 * List items awaiting review. Callers should pass their own user id as
 * `excludeAuthorId` so separation-of-duties filtering happens at the
 * database level rather than after the fact.
 */
export async function listPending(
  prisma: PrismaClient,
  filter: PendingFilter
): Promise<PendingItem[]> {
  const rows = await prisma.reviewQueueItem.findMany({
    where: {
      status: filter.status ?? 'PENDING',
      ...(filter.excludeAuthorId && {
        authorId: { not: filter.excludeAuthorId },
      }),
    },
    orderBy: { createdAt: 'asc' },
    take: filter.limit ?? 50,
  });

  return rows as unknown as PendingItem[];
}
