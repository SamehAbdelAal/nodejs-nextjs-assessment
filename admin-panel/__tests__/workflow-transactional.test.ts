import { describe, it, expect, vi } from "vitest";

vi.mock("@prisma/client", () => ({
  PrismaClient: class {},
  Role: {
    ADMIN: "ADMIN",
    CONTENT_MANAGER: "CONTENT_MANAGER",
    COMPLIANCE_OFFICER: "COMPLIANCE_OFFICER",
    SUPPORT: "SUPPORT",
    USER: "USER",
  },
  AnnouncementStatus: {
    DRAFT: "DRAFT",
    PENDING_REVIEW: "PENDING_REVIEW",
    PUBLISHED: "PUBLISHED",
    REJECTED: "REJECTED",
  },
}));

vi.mock("@/lib/review-queue/src", () => ({
  createReviewQueueClient: () => ({
    listPending: vi.fn(),
    claimNextItem: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  }),
}));

import { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import {
  approveItem,
  submitForReview,
} from "@/services/review-workflow";
import {
  TransientVerificationError,
  type VerificationAdapter,
} from "@/lib/adapters/verification";

// A small in-memory transaction simulator: writes are staged and only flushed
// to `committed` if the callback resolves; on throw, staged writes are
// dropped — modelling the rollback semantics our service relies on.
function buildPrismaMock() {
  const committed: Array<[string, unknown]> = [];
  let staged: Array<[string, unknown]> = [];

  const stage = (op: string) =>
    vi.fn().mockImplementation(async (args: unknown) => {
      staged.push([op, args]);
      // Return something shaped like a Prisma result for the create / update sites.
      return { id: `mock-${committed.length + staged.length}`, ...((args as { data?: unknown })?.data ?? {}) };
    });

  const tx = {
    announcement: {
      findUnique: vi.fn(),
      update: stage("announcement.update"),
    },
    reviewQueueItem: {
      findUnique: vi.fn(),
      create: stage("reviewQueueItem.create"),
      update: stage("reviewQueueItem.update"),
    },
    auditLog: {
      create: stage("auditLog.create"),
    },
  };

  const $transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => {
    staged = [];
    try {
      const result = await cb(tx);
      committed.push(...staged);
      staged = [];
      return result;
    } catch (err) {
      staged = []; // rollback
      throw err;
    }
  });

  const auditLogCreateOutsideTx = vi.fn().mockResolvedValue({});

  const prisma = {
    $transaction,
    auditLog: { create: auditLogCreateOutsideTx },
  };

  return { prisma, tx, committed, auditLogCreateOutsideTx };
}

describe("review-workflow — transactional rollback", () => {
  it("submitForReview rolls back when an audit write inside the tx throws — no announcement state change is committed", async () => {
    const { prisma, tx, committed } = buildPrismaMock();

    tx.announcement.findUnique.mockResolvedValue({
      id: "ann-1",
      status: "DRAFT",
      deletedAt: null,
    });
    // First create call (review queue item) succeeds; first audit fails.
    tx.auditLog.create.mockRejectedValueOnce(new Error("audit DB down"));

    const user: SessionUser = {
      id: "user-cm",
      email: "cm@x",
      name: "CM",
      role: Role.CONTENT_MANAGER,
    };

    await expect(
      submitForReview(prisma as never, "ann-1", user)
    ).rejects.toThrow("audit DB down");

    // Tx rolled back — nothing committed.
    expect(committed).toEqual([]);
  });

  it("approveItem leaves announcement state unchanged when verification throws and writes a best-effort transport audit outside the failed tx", async () => {
    const { prisma, tx, committed, auditLogCreateOutsideTx } = buildPrismaMock();

    const reviewer: SessionUser = {
      id: "user-r",
      email: "r@x",
      name: "R",
      role: Role.COMPLIANCE_OFFICER,
    };

    tx.reviewQueueItem.findUnique.mockResolvedValue({
      id: "item-1",
      announcementId: "ann-1",
      authorId: "author-other",
      claimedBy: reviewer.id,
      status: "UNDER_REVIEW",
      announcement: {
        id: "ann-1",
        titleEn: "t",
        titleAr: "ت",
        bodyEn: "b",
        bodyAr: "ب",
      },
    });

    const verification: VerificationAdapter = {
      verify: vi
        .fn()
        .mockRejectedValue(new TransientVerificationError("upstream down")),
    };

    await expect(
      approveItem(prisma as never, "item-1", reviewer, "ok", { verification })
    ).rejects.toBeInstanceOf(TransientVerificationError);

    // Tx rolled back — no committed writes (queue update + announcement update + audit all dropped).
    expect(committed).toEqual([]);

    // Best-effort transport audit lives OUTSIDE the failed tx.
    expect(auditLogCreateOutsideTx).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "VERIFICATION_TRANSPORT_FAILED",
          entityId: "item-1",
          announcementId: "ann-1",
          userId: reviewer.id,
        }),
      })
    );
  });
});
