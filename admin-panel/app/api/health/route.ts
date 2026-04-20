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

  // FIX: guard before destructuring. `prisma.findFirst` returns `T | null`;
  // the empty-table / all-soft-deleted case is a normal response, not an
  // error. Returning `latest: null` keeps the endpoint healthy instead of
  // crashing on a null dereference. The `!` non-null assertion was removed
  // so strict TypeScript narrows the type on the line below.
  if (!latest) {
    return NextResponse.json({ status: "ok", latest: null });
  }

  const { id, titleEn, titleAr, createdAt } = latest;

  return NextResponse.json({
    status: "ok",
    latest: { id, titleEn, titleAr, createdAt },
  });
}
