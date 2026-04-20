import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { userSearchSchema } from "@/lib/validations";

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

type Row = {
  id: string;
  name: string;
  role: Role;
  createdAt: Date;
  email?: string;
  phone?: string | null;
  nationalId?: string | null;
};

type SearchParams = Promise<{
  q?: string;
  page?: string;
  pageSize?: string;
}>;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = getSessionUser();
  if (!user) redirect("/admin/announcements");
  if (user.role !== Role.ADMIN && user.role !== Role.SUPPORT) {
    redirect("/admin/announcements");
  }

  const sp = await searchParams;
  const { q, page, pageSize } = userSearchSchema.parse({
    q: sp.q,
    page: sp.page,
    pageSize: sp.pageSize,
  });

  const where: Prisma.UserWhereInput =
    q && q.length > 0
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {};

  const isAdmin = user.role === Role.ADMIN;
  const select = isAdmin ? ADMIN_SELECT : SUPPORT_SELECT;

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  const users = rows as Row[];

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(p));
    params.set("pageSize", String(pageSize));
    return `/admin/users?${params.toString()}`;
  };

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Users</h1>

      <form method="get" className="flex gap-2 mb-4">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or email"
          className="border rounded p-2 flex-1"
        />
        <input type="hidden" name="pageSize" value={pageSize} />
        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded"
        >
          Search
        </button>
      </form>

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Role</th>
              {isAdmin && (
                <>
                  <th className="p-2">Email</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">National&nbsp;ID</th>
                </>
              )}
              <th className="p-2">Created</th>
              <th className="p-2">ID</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.role}</td>
                {isAdmin && (
                  <>
                    <td className="p-2">{u.email ?? "—"}</td>
                    <td className="p-2">{u.phone ?? "—"}</td>
                    <td className="p-2">{u.nationalId ?? "—"}</td>
                  </>
                )}
                <td className="p-2">
                  {new Date(u.createdAt).toISOString().slice(0, 10)}
                </td>
                <td className="p-2 font-mono text-xs">{u.id}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={isAdmin ? 7 : 4}
                  className="p-4 text-center text-gray-500"
                >
                  No users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav className="flex items-center gap-3 mt-4 text-sm">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="underline">
            Prev
          </Link>
        ) : (
          <span className="text-gray-400">Prev</span>
        )}
        <span>
          Page {page} / {totalPages} &middot; {total} total
        </span>
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className="underline">
            Next
          </Link>
        ) : (
          <span className="text-gray-400">Next</span>
        )}
      </nav>
    </main>
  );
}
