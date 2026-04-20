import { Role } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export function getSessionUser(): SessionUser | null {
  const id = process.env.MOCK_USER_ID;
  const email = process.env.MOCK_USER_EMAIL;
  const name = process.env.MOCK_USER_NAME;
  const role = process.env.MOCK_USER_ROLE;

  if (!id || !email || !name || !role) return null;
  if (!(role in Role)) return null;

  return { id, email, name, role: role as Role };
}
