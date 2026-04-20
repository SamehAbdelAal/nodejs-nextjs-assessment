import { Role } from "@prisma/client";
import type { SessionUser } from "./auth";

export type Action = "create" | "edit" | "delete" | "viewSensitive" | "view";

export function can(user: SessionUser | null, action: Action): boolean {
  if (!user) return false;
  switch (action) {
    case "create":
    case "edit":
    case "delete":
      return user.role === Role.ADMIN || user.role === Role.CONTENT_MANAGER;
    case "viewSensitive":
      return user.role === Role.ADMIN;
    case "view":
      return true;
  }
}

export function requireRole(
  user: SessionUser | null,
  ...roles: Role[]
): asserts user is SessionUser {
  if (!user || !roles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
}
