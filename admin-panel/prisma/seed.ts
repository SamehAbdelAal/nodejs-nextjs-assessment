import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin User",
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: "cm@example.com" },
    update: {},
    create: {
      email: "cm@example.com",
      name: "Content Manager",
      role: Role.CONTENT_MANAGER,
    },
  });

  await prisma.user.upsert({
    where: { email: "support@example.com" },
    update: {},
    create: {
      email: "support@example.com",
      name: "Support Agent",
      role: Role.SUPPORT,
      phone: "+1-555-0100",
      nationalId: "ID-1234567890",
    },
  });

  const announcementCount = await prisma.announcement.count();
  if (announcementCount === 0) {
    await prisma.announcement.createMany({
      data: [
        {
          titleEn: "Scheduled maintenance tonight",
          titleAr: "صيانة مجدولة الليلة",
          bodyEn:
            "The admin panel will be briefly unavailable between 23:00 and 01:00 local time.",
          bodyAr:
            "ستكون لوحة الإدارة غير متاحة لفترة وجيزة بين الساعة 23:00 و 01:00 بالتوقيت المحلي.",
          authorId: admin.id,
        },
        {
          titleEn: "New leave policy is now in effect",
          titleAr: "سياسة الإجازات الجديدة سارية المفعول",
          bodyEn:
            "Please review the updated leave policy in the HR portal before submitting new requests.",
          bodyAr:
            "يرجى مراجعة سياسة الإجازات المحدثة في بوابة الموارد البشرية قبل تقديم طلبات جديدة.",
          authorId: admin.id,
        },
      ],
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
