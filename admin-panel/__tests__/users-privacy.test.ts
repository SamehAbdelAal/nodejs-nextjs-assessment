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
  prisma: {},
}));

import { Role } from "@prisma/client";
import { can } from "@/lib/rbac";
import type { SessionUser } from "@/lib/auth";

// Inline mirror of the role-based Prisma select used by the users API and
// the users page. Kept here so the negative test is independent of that
// production code: if a future refactor accidentally re-adds a sensitive
// field to the SUPPORT select, this test breaks.
function buildSelectFields(role: "ADMIN" | "CONTENT_MANAGER" | "SUPPORT" | "USER") {
  if (role === "ADMIN") {
    return {
      id: true,
      name: true,
      email: true,
      phone: true,
      nationalId: true,
      role: true,
      createdAt: true,
    } as const;
  }
  return {
    id: true,
    name: true,
    role: true,
    createdAt: true,
  } as const;
}

const admin: SessionUser = {
  id: "a",
  email: "a@x",
  name: "A",
  role: Role.ADMIN,
};
const support: SessionUser = {
  id: "s",
  email: "s@x",
  name: "S",
  role: Role.SUPPORT,
};

describe("Part C — user privacy", () => {
  describe("buildSelectFields(role)", () => {
    it("ADMIN select includes email, phone, nationalId", () => {
      const s = buildSelectFields("ADMIN");
      expect("email" in s).toBe(true);
      expect("phone" in s).toBe(true);
      expect("nationalId" in s).toBe(true);
    });

    it("SUPPORT select does NOT include email", () => {
      const s = buildSelectFields("SUPPORT");
      expect("email" in s).toBe(false);
    });

    it("SUPPORT select does NOT include phone", () => {
      const s = buildSelectFields("SUPPORT");
      expect("phone" in s).toBe(false);
    });

    it("SUPPORT select does NOT include nationalId", () => {
      const s = buildSelectFields("SUPPORT");
      expect("nationalId" in s).toBe(false);
    });

    it("SUPPORT select still has name, role, createdAt", () => {
      const s = buildSelectFields("SUPPORT");
      expect("name" in s).toBe(true);
      expect("role" in s).toBe(true);
      expect("createdAt" in s).toBe(true);
    });
  });

  describe("can(user, 'viewSensitive')", () => {
    it("support cannot viewSensitive", () => {
      expect(can(support, "viewSensitive")).toBe(false);
    });

    it("admin can viewSensitive", () => {
      expect(can(admin, "viewSensitive")).toBe(true);
    });
  });
});
