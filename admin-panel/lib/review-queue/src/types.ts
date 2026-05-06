export type UserId = string;
export type ItemId = string;

export type ReviewStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export interface PendingItem {
  id: ItemId;
  announcementId: string;
  authorId: UserId;
  status: ReviewStatus;
  claimedBy: UserId | null;
  claimedAt: Date | null;
  decisionNote: string | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export interface PendingFilter {
  status?: ReviewStatus;
  excludeAuthorId?: UserId;
  limit?: number;
}

export type ClaimResult =
  | { kind: 'claimed'; item: PendingItem }
  | { kind: 'empty' };

export interface ReviewQueueClient {
  listPending(filter: PendingFilter): Promise<PendingItem[]>;
  claimNextItem(reviewer: UserId): Promise<ClaimResult>;
  approve(itemId: ItemId, reviewer: UserId, note: string): Promise<void>;
  reject(itemId: ItemId, reviewer: UserId, reason: string): Promise<void>;
}
