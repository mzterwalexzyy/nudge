'use client';

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="empty" role="alert">
      <strong>We couldn&rsquo;t load this view.</strong>
      <p style={{ margin: '6px 0 16px' }}>Your saved data was not changed. Try loading the local view again.</p>
      <button className="btn btn-secondary" onClick={reset}>Try again</button>
    </div>
  );
}
