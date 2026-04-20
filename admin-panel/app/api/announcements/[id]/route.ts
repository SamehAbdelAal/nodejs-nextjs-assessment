import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { announcementSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(user, "edit")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const parsed = announcementSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const existing = await prisma.announcement.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const updated = await prisma.announcement.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  await writeAuditLog({
    action: "UPDATE",
    entity: "Announcement",
    entityId: updated.id,
    userId: user.id,
    announcementId: updated.id,
    metadata: {
      before: {
        titleEn: existing.titleEn,
        titleAr: existing.titleAr,
        bodyEn: existing.bodyEn,
        bodyAr: existing.bodyAr,
      },
      after: parsed.data,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(user, "delete")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const result = await prisma.announcement.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  await writeAuditLog({
    action: "DELETE",
    entity: "Announcement",
    entityId: id,
    userId: user.id,
    announcementId: id,
  });

  return NextResponse.json({ ok: true });
}
