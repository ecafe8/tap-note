import { z } from "zod";

export const OffsetPaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const CursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type OffsetPagination = z.infer<typeof OffsetPaginationSchema>;
export type CursorPagination = z.infer<typeof CursorPaginationSchema>;
