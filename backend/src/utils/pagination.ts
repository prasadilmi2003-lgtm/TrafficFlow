import { z } from 'zod';
import type { Paginated } from '../types/domain.js';

/** Query-string fields shared by every paginated list endpoint: ?page=2&limit=20 */
export const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export interface PageRequest {
  page: number;
  limit: number;
}

export function offsetOf({ page, limit }: PageRequest): number {
  return (page - 1) * limit;
}

export function paginated<T>(items: T[], total: number, { page, limit }: PageRequest): Paginated<T> {
  return {
    items,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Escapes % and _ so user input is matched literally inside an ILIKE pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
