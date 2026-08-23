export default function AppLoading() {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-pulse" aria-hidden="true" />
      <div>
        <strong>Gathering what matters…</strong>
        <p>Reading your local NUDGE index.</p>
      </div>
    </div>
  );
}
