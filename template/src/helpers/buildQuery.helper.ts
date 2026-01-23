import type { PaginationQuery, SortOrder } from "@/types/pagination";

export default function buildQuery(
  query: Record<string, string | undefined>,
): PaginationQuery {
  const {
    page,
    pageSize,
    search,
    sortBy,
    sortOrder,
    includeDeleted,
    populateChildren,
    ...filters
  } = query;

  return {
    page: page ? parseInt(page, 10) : 1,
    pageSize: pageSize ? parseInt(pageSize, 10) : 10,
    search,
    sortBy,
    sortOrder: sortOrder as SortOrder,
    includeDeleted: includeDeleted === "true",
    populateChildren: populateChildren === "true",
    filters: Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== undefined),
    ),
  };
}
