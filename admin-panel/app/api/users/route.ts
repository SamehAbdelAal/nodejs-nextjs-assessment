import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { userSearchSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";

const ADMIN_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  nationalId: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const SUPPORT_SELECT = {
  id: true,
  name: true,
  role: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function GET(req: NextRequest) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (user.role !== Role.ADMIN && user.role !== Role.SUPPORT) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = userSearchSchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }
  const { q, page, pageSize } = parsed.data;

  const where: Prisma.UserWhereInput =
    q && q.length > 0
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

  // Field-level enforcement is done by Prisma `select`: the database never
  // returns sensitive columns for SUPPORT callers, so there is nothing to
  // filter in memory and no way for a crafted request to opt back in.
  const select = user.role === Role.ADMIN ? ADMIN_SELECT : SUPPORT_SELECT;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, pageSize });
}
