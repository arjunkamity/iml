export interface ListResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): ListResult<T> {
  return { data, total, page, limit };
}
