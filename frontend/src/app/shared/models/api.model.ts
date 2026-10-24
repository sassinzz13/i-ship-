export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

/** Query parameters accepted by paginated list endpoints. */
export type ListParams = Record<string, string | number | boolean | null | undefined>;
