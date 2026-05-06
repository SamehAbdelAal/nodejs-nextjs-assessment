import { AnnouncementStatus, Role } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import type { SessionUser } from "@/lib/auth";
import type {
  VerificationAdapter,
  VerificationResult,
} from "@/lib/adapters/verification";
import { createReviewQueueClient } from "@/lib/review-queue/src";
import type { ClaimResult } from "@/lib/review-queue/src";

export class SelfReviewError extends Error {
  constructor(message: string = "reviewer cannot review their own item") {
    super(message);
    this.name = "SelfReviewError";
  }
}

export class WorkflowAuthorizationError extends Error {
  constructor(message: string = "not authorized") {
    super(message);
    this.name = "WorkflowAuthorizationError";
  }
}

export class WorkflowStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowStateError";
  }
}

export class WorkflowNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowNotFoundError";
  }
}

export interface ApproveItemDeps {
  verification: VerificationAdapter;
}

export interface EscalateResult {
  escalated: number;
}

const OVERDUE_AGE_MS = 48 * 60 * 60 * 1000;

export async function submitForReview(
  prisma: PrismaClient,
  announcementId: string,
  user: SessionUser
): Promise<void> {
  if (user.role !== Role.ADMIN && user.role !== Role.CONTENT_MANAGER) {
    throw new WorkflowAuthorizationError(
      "only ADMIN or CONTENT_MANAGER may submit for review"
    );
  }

  await prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.findUnique({
      where: { id: announcementId },
    });
    if (!announcement || announcement.deletedAt !== null) {
      throw new WorkflowNotFoundError(
        `announcement ${announcementId} not found`
      );
    }
    if (announcement.status !== AnnouncementStatus.DRAFT) {
      throw new WorkflowStateError(
        `cannot submit announcement in status ${announcement.status}`
      );
    }

    await tx.announcement.update({
      where: { id: announcementId },
      data: { status: AnnouncementStatus.PENDING_REVIEW },
    });

    const item = await tx.reviewQueueItem.create({
      data: {
        announcementId,
        authorId: user.id,
        status: "PENDING",
        tier: 1,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "SUBMIT_FOR_REVIEW",
        entity: "Announcement",
        entityId: announcementId,
        userId: user.id,
        announcementId,
        metadata: { reviewQueueItemId: item.id, tier: 1 },
      },
    });

    await tx.auditLog.create({
      data: {
        action: "NOTIFICATION_QUEUED",
        entity: "ReviewQueueItem",
        entityId: item.id,
        userId: user.id,
        announcementId,
        metadata: {
          recipientRole: "COMPLIANCE_OFFICER",
          event: "SUBMIT_FOR_REVIEW",
        },
      },
    });
  });
}

export async function claimNext(
  prisma: PrismaClient,
  reviewer: SessionUser
): Promise<ClaimResult> {
  if (
    reviewer.role !== Role.ADMIN &&
    reviewer.role !== Role.COMPLIANCE_OFFICER
  ) {
    throw new WorkflowAuthorizationError(
      "only ADMIN or COMPLIANCE_OFFICER may claim review items"
    );
  }

  const queue = createReviewQueueClient(prisma);

  // Visible-to-reviewer pre-check: if no non-self item is pending, skip the
  // claim entirely so we don't lock a self-authored row.
  const visible = await queue.listPending({
    excludeAuthorId: reviewer.id,
    limit: 1,
  });
  if (visible.length === 0) {
    return { kind: "empty" };
  }

  const result = await queue.claimNextItem(reviewer.id);
  if (result.kind === "empty") return result;

  // Defence in depth — claimNextItem (SELECT ... FOR UPDATE SKIP LOCKED) does
  // not filter by author. If the oldest pending row turns out to be authored
  // by the reviewer (race vs. listPending), release the row back to the pool
  // and reject the claim.
  if (result.item.authorId === reviewer.id) {
    await prisma.reviewQueueItem.update({
      where: { id: result.item.id },
      data: {
        status: "PENDING",
        claimedBy: null,
        claimedAt: null,
      },
    });
    throw new SelfReviewError(
      `reviewer ${reviewer.id} cannot claim own authored item`
    );
  }

  return result;
}

export async function approveItem(
  prisma: PrismaClient,
  itemId: string,
  reviewer: SessionUser,
  note: string,
  deps: ApproveItemDeps
): Promise<VerificationResult> {
  let announcementIdForAudit: string | null = null;

  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.reviewQueueItem.findUnique({
        where: { id: itemId },
        include: { announcement: true },
      });
      if (!item) {
        throw new WorkflowNotFoundError(`review item ${itemId} not found`);
      }
      announcementIdForAudit = item.announcementId;

      if (item.authorId === reviewer.id) {
        throw new SelfReviewError();
      }
      if (item.claimedBy !== reviewer.id) {
        throw new WorkflowAuthorizationError(
          "only the claiming reviewer may approve this item"
        );
      }
      if (item.status !== "UNDER_REVIEW") {
        throw new WorkflowStateError(
          `cannot approve an item in status ${item.status}`
        );
      }

      // The seeded queue.approve wraps its update in its own
      // prisma.$transaction; Prisma forbids interactive nested transactions on
      // a TransactionClient, so we inline the equivalent update here. That
      // keeps the queue change, announcement state change, and audit row
      // atomic: if verification fails, all three roll back together.
      await tx.reviewQueueItem.update({
        where: { id: itemId },
        data: {
          status: "APPROVED",
          decisionNote: note,
          decidedAt: new Date(),
        },
      });

      const verdict = await deps.verification.verify({
        id: item.announcement.id,
        titleEn: item.announcement.titleEn,
        titleAr: item.announcement.titleAr,
        bodyEn: item.announcement.bodyEn,
        bodyAr: item.announcement.bodyAr,
      });

      if (verdict.verdict === "APPROVED") {
        await tx.announcement.update({
          where: { id: item.announcementId },
          data: {
            status: AnnouncementStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            action: "VERIFICATION_PASSED",
            entity: "Announcement",
            entityId: item.announcementId,
            userId: reviewer.id,
            announcementId: item.announcementId,
            metadata: {
              reviewQueueItemId: itemId,
              verifiedAt: verdict.verifiedAt.toISOString(),
            },
          },
        });
      } else {
        await tx.announcement.update({
          where: { id: item.announcementId },
          data: { status: AnnouncementStatus.DRAFT },
        });
        await tx.auditLog.create({
          data: {
            action: "VERIFICATION_REJECTED",
            entity: "Announcement",
            entityId: item.announcementId,
            userId: reviewer.id,
            announcementId: item.announcementId,
            metadata: {
              reviewQueueItemId: itemId,
              reason: verdict.reason ?? null,
              verifiedAt: verdict.verifiedAt.toISOString(),
            },
          },
        });
      }

      return verdict;
    });
  } catch (err) {
    const isWorkflowError =
      err instanceof SelfReviewError ||
      err instanceof WorkflowAuthorizationError ||
      err instanceof WorkflowNotFoundError ||
      err instanceof WorkflowStateError;

    if (!isWorkflowError && announcementIdForAudit) {
      // Best-effort audit: the workflow tx rolled back, so this write happens
      // outside it. Failure to write is swallowed — we still rethrow the
      // original error to the caller.
      await prisma.auditLog
        .create({
          data: {
            action: "VERIFICATION_TRANSPORT_FAILED",
            entity: "ReviewQueueItem",
            entityId: itemId,
            userId: reviewer.id,
            announcementId: announcementIdForAudit,
            metadata: {
              error: err instanceof Error ? err.message : String(err),
              errorName: err instanceof Error ? err.name : "unknown",
            },
          },
        })
        .catch(() => undefined);
    }
    throw err;
  }
}

export async function rejectItem(
  prisma: PrismaClient,
  itemId: string,
  reviewer: SessionUser,
  reason: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const item = await tx.reviewQueueItem.findUnique({
      where: { id: itemId },
    });
    if (!item) {
      throw new WorkflowNotFoundError(`review item ${itemId} not found`);
    }
    if (item.authorId === reviewer.id) {
      throw new SelfReviewError();
    }
    if (item.claimedBy !== reviewer.id) {
      throw new WorkflowAuthorizationError(
        "only the claiming reviewer may reject this item"
      );
    }
    if (item.status !== "UNDER_REVIEW") {
      throw new WorkflowStateError(
        `cannot reject an item in status ${item.status}`
      );
    }

    // Inlined for the same atomicity reason as approveItem.
    await tx.reviewQueueItem.update({
      where: { id: itemId },
      data: {
        status: "REJECTED",
        decisionNote: reason,
        decidedAt: new Date(),
      },
    });

    await tx.announcement.update({
      where: { id: item.announcementId },
      data: { status: AnnouncementStatus.DRAFT },
    });

    await tx.auditLog.create({
      data: {
        action: "REJECTED",
        entity: "Announcement",
        entityId: item.announcementId,
        userId: reviewer.id,
        announcementId: item.announcementId,
        metadata: { reviewQueueItemId: itemId, reason },
      },
    });

    await tx.auditLog.create({
      data: {
        action: "NOTIFICATION_QUEUED",
        entity: "ReviewQueueItem",
        entityId: itemId,
        userId: reviewer.id,
        announcementId: item.announcementId,
        metadata: {
          recipientId: item.authorId,
          event: "REJECTED",
        },
      },
    });
  });
}

export async function escalateOverdue(
  prisma: PrismaClient,
  now: Date = new Date()
): Promise<EscalateResult> {
  const cutoff = new Date(now.getTime() - OVERDUE_AGE_MS);

  return prisma.$transaction(async (tx) => {
    const overdue = await tx.reviewQueueItem.findMany({
      where: {
        status: "PENDING",
        claimedBy: null,
        tier: 1,
        createdAt: { lt: cutoff },
      },
      select: { id: true, announcementId: true, authorId: true },
    });

    if (overdue.length === 0) {
      return { escalated: 0 };
    }

    await tx.reviewQueueItem.updateMany({
      where: { id: { in: overdue.map((o) => o.id) } },
      data: { tier: 2, escalatedAt: now },
    });

    // No acting user is passed (escalation is a system / scheduler operation);
    // the audit row is attributed to the item's original author so the
    // AuditLog → User foreign key remains satisfied.
    await tx.auditLog.createMany({
      data: overdue.map((o) => ({
        action: "ESCALATED",
        entity: "ReviewQueueItem",
        entityId: o.id,
        userId: o.authorId,
        announcementId: o.announcementId,
        metadata: { tier: 2, escalatedAt: now.toISOString() },
      })),
    });

    return { escalated: overdue.length };
  });
}
