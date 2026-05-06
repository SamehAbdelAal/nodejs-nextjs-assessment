import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { claimNextItem } from "@/lib/review-queue/src/claim";

// This is a real-Postgres integration test. It exercises the claim primitive
// with five concurrent callers on five separate connections and asserts the
// queue invariant: "exactly one reviewer wins each pending item." Without a
// database the suite is skipped — pure mocks cannot reproduce row-level
// locking semantics.
const HAS_DB = !!process.env.DATABASE_URL;
const dbUrl = process.env.DATABASE_URL ?? "";

function newClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: dbUrl }),
  });
}

describe.skipIf(!HAS_DB)("claimNextItem (Postgres concurrency)", () => {
  const setup = HAS_DB ? newClient() : (null as unknown as PrismaClient);

  let userId: string;
  let announcementId: string;
  let itemId: string;

  beforeAll(async () => {
    const user = await setup.user.create({
      data: {
        email: `race-author-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`,
        name: "Race Test Author",
      },
    });
    userId = user.id;

    const announcement = await setup.announcement.create({
      data: {
        titleEn: "Race test announcement",
        titleAr: "إعلان اختبار التزامن",
        bodyEn: "race body en",
        bodyAr: "محتوى اختبار",
        authorId: userId,
      },
    });
    announcementId = announcement.id;

    const item = await setup.reviewQueueItem.create({
      data: {
        announcementId,
        authorId: userId,
        status: "PENDING",
      },
    });
    itemId = item.id;
  });

  afterAll(async () => {
    if (!HAS_DB) return;
    await setup.reviewQueueItem.deleteMany({ where: { id: itemId } });
    await setup.announcement.deleteMany({ where: { id: announcementId } });
    await setup.user.deleteMany({ where: { id: userId } });
    await setup.$disconnect();
  });

  it("exactly one of five concurrent claims succeeds; four return empty", async () => {
    const reviewers = ["reviewer-A", "reviewer-B", "reviewer-C", "reviewer-D", "reviewer-E"];
    // Each caller gets its own PrismaClient so they never share a connection
    // — guarantees real overlap at the database layer, not pool serialisation.
    const clients = reviewers.map(() => newClient());

    try {
      const results = await Promise.all(
        clients.map((c, i) => claimNextItem(c, reviewers[i]))
      );

      const claimed = results.filter((r) => r.kind === "claimed");
      const empty = results.filter((r) => r.kind === "empty");

      expect(claimed.length).toBe(1);
      expect(empty.length).toBe(4);
    } finally {
      await Promise.all(clients.map((c) => c.$disconnect()));
    }
  });
});
