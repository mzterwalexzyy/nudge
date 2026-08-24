import Link from 'next/link';

export type PageSearchParams = { page?: string | string[] };

export function pageFromSearchParam(rawPage: PageSearchParams['page']) {
  const value = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const requested = Number(value);
  return Number.isInteger(requested) && requested > 0 ? requested : 1;
}

function pageHref(basePath: string, page: number) {
  return page === 1 ? basePath : `${basePath}?page=${page}`;
}

export default function Pagination({
  basePath,
  page,
  totalPages,
  label,
}: {
  basePath: string;
  page: number;
  totalPages: number;
  label: string;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label={label}>
      {page > 1 ? (
        <Link className="pagination-link" href={pageHref(basePath, page - 1)} rel="prev">Previous</Link>
      ) : (
        <span className="pagination-link disabled" aria-disabled="true">Previous</span>
      )}
      <span className="pagination-status">Page {page} of {totalPages}</span>
      {page < totalPages ? (
        <Link className="pagination-link" href={pageHref(basePath, page + 1)} rel="next">Next</Link>
      ) : (
        <span className="pagination-link disabled" aria-disabled="true">Next</span>
      )}
    </nav>
  );
}
