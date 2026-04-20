import { z } from "zod";

export const announcementSchema = z.object({
  titleEn: z.string().min(1, "titleEn is required"),
  titleAr: z.string().min(1, "titleAr is required"),
  bodyEn: z.string().min(1, "bodyEn is required"),
  bodyAr: z.string().min(1, "bodyAr is required"),
});

export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const userSearchSchema = paginationSchema.extend({
  q: z.string().trim().optional(),
});

export type UserSearchInput = z.infer<typeof userSearchSchema>;
