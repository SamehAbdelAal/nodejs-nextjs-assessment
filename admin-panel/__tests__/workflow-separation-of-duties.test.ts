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

const queueMocks = {
  listPending: vi.fn(),
  claimNextItem: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
};

vi.mock("@/lib/review-queue/src", () => ({
  createReviewQueueClient: () => queueMocks,
}));

import { Role } from "@prisma/client";
import type { SessionUser } from "@/lib/auth";
import {
  SelfReviewError,
  approveItem,
  claimNext,
} from "@/services/review-workflow";
import { MockVerificationAdapter } from "@/lib/adapters/verification";

const compliance: SessionUser = {
  id: "user-compliance",
  email: "c@x",
  name: "C",
  role: Role.COMPLIANCE_OFFICER,
};

describe("review-workflow — separation of duties", () => {
  it("claimNext throws SelfReviewError when SKIP LOCKED races to a self-authored row, and releases the row", async () => {
    queueMocks.listPending.mockResolvedValueOnce([
      { id: "item-other", authorId: "another-user" },
    ]);
    queueMocks.claimNextItem.mockResolvedValueOnce({
      kind: "claimed",
      item: {
        id: "item-1",
        announcementId: "ann-1",
        authorId: compliance.id,
        status: "UNDER_REVIEW",
        claimedBy: compliance.id,
        claimedAt: new Date(0),
        decisionNote: null,
        decidedAt: null,
        createdAt: new Date(0),
      },
    });

    const update = vi.fn().mockResolvedValue({});
    const prisma = {
      reviewQueueItem: { update },
    } as never;

    await expect(claimNext(prisma, compliance)).rejects.toBeInstanceOf(
      SelfReviewError
    );

    // The defence-in-depth release back to PENDING ran.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1" },
        data: expect.objectContaining({
          status: "PENDING",
          claimedBy: null,
        }),
      })
    );
  });

  it("approveItem throws SelfReviewError when the item author equals the reviewer", async () => {
    const item = {
      id: "item-1",
      announcementId: "ann-1",
      authorId: compliance.id,
      claimedBy: compliance.id,
      status: "UNDER_REVIEW",
      announcement: {
        id: "ann-1",
        titleEn: "t",
        titleAr: "ت",
        bodyEn: "b",
        bodyAr: "ب",
      },
    };

    const tx = {
      reviewQueueItem: {
        findUnique: vi.fn().mockResolvedValue(item),
        update: vi.fn().mockResolvedValue({}),
      },
      announcement: { update: vi.fn().mockResolvedValue({}) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    };

    const $transaction = vi.fn().mockImplementation((cb) => cb(tx));
    const prisma = {
      $transaction,
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    } as never;

    await expect(
      approveItem(prisma, "item-1", compliance, "looks fine", {
        verification: new MockVerificationAdapter(),
      })
    ).rejects.toBeInstanceOf(SelfReviewError);

    // Self-review is detected before any state mutation.
    expect(tx.reviewQueueItem.update).not.toHaveBeenCalled();
    expect(tx.announcement.update).not.toHaveBeenCalled();
  });
});
