import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const include = url.searchParams.get("include");

  if (include !== "latest") {
    return NextResponse.json({ status: "ok" });
  }

  const latest = await prisma.announcement.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  // BUG: destructures `latest` without a null check. `prisma.findFirst` is
  // typed as `T | null`, but the `!` below silences the compiler instead of
  // handling the empty case. When the Announcement table is empty — or every
  // row is soft-deleted — `latest` is null and this line throws:
  //   TypeError: Cannot destructure property 'id' of 'null' as it is null.
  // The endpoint then returns HTTP 500. Looks intermittent because content
  // is usually present in a live environment.
  const { id, titleEn, titleAr, createdAt } = latest!;

  return NextResponse.json({
    status: "ok",
    latest: { id, titleEn, titleAr, createdAt },
  });
}
