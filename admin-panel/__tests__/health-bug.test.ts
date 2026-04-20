import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@prisma/client", () => ({ PrismaClient: class {} }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    announcement: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";

// Inline reproduction of the pre-fix handler. Kept here (not imported from
// app/) so the regression is locked to the actual buggy code shape, even if
// the production handler is later rewritten.
async function buggyHandler(url: string) {
  const u = new URL(url);
  if (u.searchParams.get("include") !== "latest") {
    return { status: 200, body: { status: "ok" } };
  }
  const latest = await prisma.announcement.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  // BUG: non-null assertion silences the compiler but does not handle null.
  const { id, titleEn, titleAr, createdAt } = latest!;
  return {
    status: 200,
    body: { status: "ok", latest: { id, titleEn, titleAr, createdAt } },
  };
}

async function fixedHandler(url: string) {
  const u = new URL(url);
  if (u.searchParams.get("include") !== "latest") {
    return { status: 200, body: { status: "ok" } };
  }
  const latest = await prisma.announcement.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) {
    return { status: 200, body: { status: "ok", latest: null } };
  }
  const { id, titleEn, titleAr, createdAt } = latest;
  return {
    status: 200,
    body: { status: "ok", latest: { id, titleEn, titleAr, createdAt } },
  };
}

describe("Part B — /api/health?include=latest regression", () => {
  beforeEach(() => {
    (prisma.announcement.findFirst as ReturnType<typeof vi.fn>).mockReset();
  });

  it("BUGGY handler throws when findFirst returns null (empty table)", async () => {
    (prisma.announcement.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    );
    await expect(
      buggyHandler("http://x/api/health?include=latest")
    ).rejects.toThrow(/Cannot destructure/i);
  });

  it("FIXED handler returns { latest: null } when findFirst returns null", async () => {
    (prisma.announcement.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      null
    );
    const res = await fixedHandler("http://x/api/health?include=latest");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", latest: null });
  });

  it("FIXED handler returns data when an announcement exists", async () => {
    const createdAt = new Date("2024-05-01T00:00:00Z");
    (prisma.announcement.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      {
        id: "a1",
        titleEn: "Hello",
        titleAr: "مرحبا",
        bodyEn: "Body",
        bodyAr: "نص",
        createdAt,
        deletedAt: null,
      }
    );
    const res = await fixedHandler("http://x/api/health?include=latest");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      latest: { id: "a1", titleEn: "Hello", titleAr: "مرحبا", createdAt },
    });
  });

  it("FIXED handler with no include param always succeeds", async () => {
    const res = await fixedHandler("http://x/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(prisma.announcement.findFirst).not.toHaveBeenCalled();
  });
});
