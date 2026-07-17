/** Unified API response envelope */
export interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
}

/** Offset-based paginated response data wrapper */
export interface PaginatedData<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/** Cursor-based paginated response data wrapper */
export interface CursorPaginatedData<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
}
