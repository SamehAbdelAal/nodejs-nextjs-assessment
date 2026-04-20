import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import EditForm from "./EditForm";

type Params = Promise<{ id: string }>;

export default async function EditAnnouncementPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const user = getSessionUser();
  if (!can(user, "edit")) {
    redirect("/admin/announcements");
  }

  const announcement = await prisma.announcement.findFirst({
    where: { id, deletedAt: null },
  });
  if (!announcement) notFound();

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Edit announcement</h1>
      <EditForm
        id={announcement.id}
        initial={{
          titleEn: announcement.titleEn,
          titleAr: announcement.titleAr,
          bodyEn: announcement.bodyEn,
          bodyAr: announcement.bodyAr,
        }}
        canDelete={can(user, "delete")}
      />
    </main>
  );
}
