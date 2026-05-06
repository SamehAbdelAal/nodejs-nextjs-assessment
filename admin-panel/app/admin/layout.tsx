import Link from "next/link";
import type { ReactNode } from "react";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const user = getSessionUser();
  const canReview = can(user, "review");

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r bg-gray-50 p-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Admin
        </div>
        <nav className="space-y-1 text-sm">
          <Link
            href="/admin/announcements"
            className="block px-2 py-1.5 rounded hover:bg-gray-200"
          >
            Announcements
          </Link>
          <Link
            href="/admin/users"
            className="block px-2 py-1.5 rounded hover:bg-gray-200"
          >
            Users
          </Link>
          {canReview && (
            <Link
              href="/admin/review-queue"
              className="block px-2 py-1.5 rounded hover:bg-gray-200"
            >
              Review queue
            </Link>
          )}
        </nav>
        {user && (
          <div className="mt-6 pt-4 border-t text-xs text-gray-600">
            <div className="font-medium truncate">{user.name}</div>
            <div className="truncate">{user.email}</div>
            <div className="mt-1 text-gray-500">{user.role}</div>
          </div>
        )}
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
