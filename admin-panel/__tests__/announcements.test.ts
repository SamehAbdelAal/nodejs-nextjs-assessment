import { describe, it, expect, vi } from "vitest";

vi.mock("@prisma/client", () => ({
  PrismaClient: class {},
  Role: {
    ADMIN: "ADMIN",
    CONTENT_MANAGER: "CONTENT_MANAGER",
    SUPPORT: "SUPPORT",
    USER: "USER",
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    announcement: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    user: { findMany: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

import { Role } from "@prisma/client";
import { can } from "@/lib/rbac";
import { announcementSchema } from "@/lib/validations";
import type { SessionUser } from "@/lib/auth";

const admin: SessionUser = { id: "1", email: "a@x", name: "A", role: Role.ADMIN };
const cm: SessionUser = {
  id: "2",
  email: "c@x",
  name: "C",
  role: Role.CONTENT_MANAGER,
};
const support: SessionUser = {
  id: "3",
  email: "s@x",
  name: "S",
  role: Role.SUPPORT,
};

describe("RBAC can()", () => {
  it("ADMIN can create/edit/delete", () => {
    expect(can(admin, "create")).toBe(true);
    expect(can(admin, "edit")).toBe(true);
    expect(can(admin, "delete")).toBe(true);
  });

  it("CONTENT_MANAGER can create/edit/delete", () => {
    expect(can(cm, "create")).toBe(true);
    expect(can(cm, "edit")).toBe(true);
    expect(can(cm, "delete")).toBe(true);
  });

  it("SUPPORT cannot create/edit/delete", () => {
    expect(can(support, "create")).toBe(false);
    expect(can(support, "edit")).toBe(false);
    expect(can(support, "delete")).toBe(false);
  });

  it("null user is always forbidden", () => {
    expect(can(null, "create")).toBe(false);
    expect(can(null, "edit")).toBe(false);
    expect(can(null, "delete")).toBe(false);
    expect(can(null, "viewSensitive")).toBe(false);
    expect(can(null, "view")).toBe(false);
  });

  it("ADMIN can viewSensitive, SUPPORT cannot", () => {
    expect(can(admin, "viewSensitive")).toBe(true);
    expect(can(support, "viewSensitive")).toBe(false);
  });
});

describe("announcementSchema", () => {
  const valid = {
    titleEn: "Hello",
    titleAr: "مرحبا",
    bodyEn: "Body text",
    bodyAr: "نص",
  };

  it("valid bilingual input passes", () => {
    const r = announcementSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("empty titleAr rejected", () => {
    const r = announcementSchema.safeParse({ ...valid, titleAr: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.titleAr?.length).toBeGreaterThan(0);
    }
  });

  it("empty bodyEn rejected", () => {
    const r = announcementSchema.safeParse({ ...valid, bodyEn: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.bodyEn?.length).toBeGreaterThan(0);
    }
  });

  it("empty bodyAr rejected", () => {
    const r = announcementSchema.safeParse({ ...valid, bodyAr: "" });
    expect(r.success).toBe(false);
  });

  it("missing titleEn rejected", () => {
    const { titleEn: _drop, ...rest } = valid;
    void _drop;
    const r = announcementSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  it("empty payload rejected", () => {
    const r = announcementSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) {
      const fe = r.error.flatten().fieldErrors;
      expect(fe.titleEn).toBeTruthy();
      expect(fe.titleAr).toBeTruthy();
      expect(fe.bodyEn).toBeTruthy();
      expect(fe.bodyAr).toBeTruthy();
    }
  });
});
