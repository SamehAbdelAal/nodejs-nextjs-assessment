import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { announcementSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!can(user, "create")) {
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

  const announcement = await prisma.announcement.create({
    data: { ...parsed.data, authorId: user.id },
  });

  await writeAuditLog({
    action: "CREATE",
    entity: "Announcement",
    entityId: announcement.id,
    userId: user.id,
    announcementId: announcement.id,
    metadata: {
      titleEn: announcement.titleEn,
      titleAr: announcement.titleAr,
    },
  });

  return NextResponse.json(announcement, { status: 201 });
}
