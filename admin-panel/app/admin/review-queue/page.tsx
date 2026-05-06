import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import ReviewActions from "./ReviewActions";

export default async function ReviewQueuePage() {
  const user = getSessionUser();
  if (!can(user, "review")) {
    redirect("/admin");
  }

  // Two slices the reviewer needs to see together:
  //   • PENDING items not authored by the current user — claim candidates.
  //   • UNDER_REVIEW items the current user has already claimed — approve / reject candidates.
  // listPending only returns the first slice; we read both directly so the
  // page can show the reviewer's full active surface in one table.
  const [pending, mine] = await Promise.all([
    prisma.reviewQueueItem.findMany({
      where: {
        status: "PENDING",
        claimedBy: null,
        authorId: { not: user!.id },
      },
      orderBy: { createdAt: "asc" },
      include: {
        announcement: {
          select: { id: true, titleEn: true, titleAr: true },
        },
      },
    }),
    prisma.reviewQueueItem.findMany({
      where: {
        status: "UNDER_REVIEW",
        claimedBy: user!.id,
      },
      orderBy: { claimedAt: "asc" },
      include: {
        announcement: {
          select: { id: true, titleEn: true, titleAr: true },
        },
      },
    }),
  ]);

  type Row = (typeof pending)[number];
  const rows: Row[] = [...mine, ...pending];

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Review queue</h1>
        <ReviewActions mode="claim-next" />
      </div>

      <table className="w-full border rounded text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="p-2 font-medium">Announcement</th>
            <th className="p-2 font-medium">Status</th>
            <th className="p-2 font-medium">Tier</th>
            <th className="p-2 font-medium">Created</th>
            <th className="p-2 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="p-2">
                <div className="font-medium truncate">
                  {r.announcement.titleEn}
                </div>
                <div
                  className="text-xs text-gray-500 truncate"
                  dir="rtl"
                >
                  {r.announcement.titleAr}
                </div>
              </td>
              <td className="p-2">{r.status}</td>
              <td className="p-2">{r.tier}</td>
              <td className="p-2 text-gray-500">
                {new Date(r.createdAt).toLocaleString()}
              </td>
              <td className="p-2 text-right">
                {r.status === "UNDER_REVIEW" && r.claimedBy === user!.id ? (
                  <ReviewActions mode="decide" itemId={r.id} />
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="p-4 text-gray-500" colSpan={5}>
                Nothing to review.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
