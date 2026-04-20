import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface WriteAuditLogOptions {
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  announcementId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function writeAuditLog(opts: WriteAuditLogOptions) {
  return prisma.auditLog.create({
    data: {
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId,
      userId: opts.userId,
      announcementId: opts.announcementId,
      metadata: opts.metadata,
    },
  });
}
