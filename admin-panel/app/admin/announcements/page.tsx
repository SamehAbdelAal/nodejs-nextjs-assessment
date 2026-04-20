import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { paginationSchema } from "@/lib/validations";

type SearchParams = Promise<{ page?: string; pageSize?: string }>;

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { page, pageSize } = paginationSchema.parse({
    page: sp.page,
    pageSize: sp.pageSize,
  });

  const user = getSessionUser();
  const canEdit = can(user, "edit");

  const where = { deletedAt: null };
  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.announcement.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Announcements</h1>
        {canEdit && (
          <Link
            href="/admin/announcements/new"
            className="bg-black text-white px-3 py-1.5 rounded text-sm"
          >
            New
          </Link>
        )}
      </div>

      <ul className="divide-y border rounded">
        {items.map((a) => (
          <li
            key={a.id}
            className="p-3 flex justify-between items-center gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{a.titleEn}</div>
              <div
                className="text-sm text-gray-500 truncate"
                dir="rtl"
              >
                {a.titleAr}
              </div>
            </div>
            {canEdit && (
              <Link
                href={`/admin/announcements/${a.id}/edit`}
                className="underline text-sm shrink-0"
              >
                Edit
              </Link>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="p-4 text-gray-500 text-sm">No announcements.</li>
        )}
      </ul>

      <nav className="flex items-center gap-3 mt-4 text-sm">
        {page > 1 ? (
          <Link
            href={`/admin/announcements?page=${page - 1}&pageSize=${pageSize}`}
            className="underline"
          >
            Prev
          </Link>
        ) : (
          <span className="text-gray-400">Prev</span>
        )}
        <span>
          Page {page} / {totalPages} &middot; {total} total
        </span>
        {page < totalPages ? (
          <Link
            href={`/admin/announcements?page=${page + 1}&pageSize=${pageSize}`}
            className="underline"
          >
            Next
          </Link>
        ) : (
          <span className="text-gray-400">Next</span>
        )}
      </nav>
    </main>
  );
}
