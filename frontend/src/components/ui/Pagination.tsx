import type { Paginated } from '../../types/api';
import { Button } from './Button';

export function Pagination({ pagination, onPage }: { pagination: Paginated<unknown>['pagination']; onPage: (page: number) => void }) {
  const { page, totalPages, total, limit } = pagination;
  if (total === 0) return null;

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <nav className="mt-4 flex items-center justify-between text-sm text-slate-600" aria-label="Pagination">
      <p>
        Showing <span className="font-medium">{first}</span>–<span className="font-medium">{last}</span> of{' '}
        <span className="font-medium">{total}</span>
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
