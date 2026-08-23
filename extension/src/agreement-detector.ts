/** Detect agreement pages and render the pipeline's ranked clauses in-page. */

const KEYWORDS = [
  'terms of service', 'terms of use', 'terms and conditions', 'terms & conditions',
  'privacy policy', 'privacy notice', 'end user license', 'eula',
  'subscription terms', 'cookie policy', 'user agreement', 'acceptable use',
];

type Clause = { label: string; level: 'low' | 'review' | 'important' | 'high'; plain_explanation: string };

function looksLikeAgreement(): { yes: boolean; heading: string } {
  const haystack = `${document.title} ${document.querySelector('h1')?.textContent || ''} ${location.href}`.toLowerCase();
  for (const keyword of KEYWORDS) {
    if (haystack.includes(keyword)) return { yes: true, heading: keyword };
  }
  if (/\/(terms|privacy|legal|tos|eula)(\/|$|\.)/.test(location.href.toLowerCase())) {
    return { yes: true, heading: 'legal page' };
  }
  return { yes: false, heading: '' };
}

function getReadableFallback(): string {
  const main = document.querySelector('main, article, [role="main"]') || document.body;
  return (main.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12_000);
}

function injectBadge() {
  if (document.getElementById('sb-badge')) return;
  const badge = document.createElement('button');
  badge.id = 'sb-badge';
  badge.type = 'button';
  badge.textContent = 'NUDGE: worth reviewing';
  badge.setAttribute('aria-label', 'Analyze this agreement with NUDGE');
  Object.assign(badge.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
    border: '0', background: '#0f766e', color: '#fff', padding: '10px 14px', borderRadius: '10px',
    font: '600 13px -apple-system, Segoe UI, Roboto, sans-serif',
    boxShadow: '0 4px 16px rgba(0,0,0,.2)', cursor: 'pointer', maxWidth: '260px',
  } as CSSStyleDeclaration);
  badge.addEventListener('click', analyzeAgreement);
  document.body.appendChild(badge);
}

function analyzeAgreement() {
  const badge = document.getElementById('sb-badge') as HTMLButtonElement | null;
  if (badge) {
    badge.textContent = 'Analyzing…';
    badge.disabled = true;
  }

  chrome.runtime.sendMessage(
    { type: 'ANALYZE_AGREEMENT', url: location.href, title: document.title, text: getReadableFallback() },
    (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        if (badge) {
          badge.textContent = response?.error || response?.result?.error || 'NUDGE: analysis failed';
          badge.disabled = false;
        }
        return;
      }
      renderPanel(response.result?.clauses || []);
    },
  );
}

function renderPanel(clauses: Clause[]) {
  document.getElementById('sb-badge')?.remove();
  document.getElementById('sb-panel')?.remove();

  const panel = document.createElement('section');
  panel.id = 'sb-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Agreement analysis');
  Object.assign(panel.style, {
    position: 'fixed', bottom: '20px', right: '20px', zIndex: '2147483647',
    background: '#fff', color: '#1a1d21', padding: '16px', borderRadius: '12px',
    width: 'min(360px, calc(100vw - 40px))', maxHeight: 'min(560px, calc(100vh - 40px))', overflowY: 'auto',
    boxShadow: '0 8px 28px rgba(0,0,0,.22)', font: '13px -apple-system, Segoe UI, Roboto, sans-serif',
    border: '1px solid #eceef1',
  } as CSSStyleDeclaration);

  const heading = document.createElement('h2');
  heading.textContent = `${clauses.length} thing${clauses.length === 1 ? '' : 's'} worth knowing`;
  Object.assign(heading.style, { fontSize: '15px', margin: '0 0 12px' });
  panel.appendChild(heading);

  const colors: Record<string, string> = { high: '#e11d48', important: '#ea580c', review: '#d97706', low: '#16a34a' };
  for (const clause of clauses) {
    const row = document.createElement('article');
    Object.assign(row.style, { padding: '10px 0', borderTop: '1px solid #eceef1' });
    const label = document.createElement('div');
    label.textContent = `${clause.level.toUpperCase()} · ${clause.label}`;
    Object.assign(label.style, { color: colors[clause.level] || '#d97706', fontWeight: '700', marginBottom: '4px' });
    const explanation = document.createElement('p');
    explanation.textContent = clause.plain_explanation;
    Object.assign(explanation.style, { color: '#59616c', lineHeight: '1.45', margin: '0' });
    row.append(label, explanation);
    panel.appendChild(row);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  Object.assign(close.style, {
    display: 'block', margin: '12px 0 0 auto', border: '0', background: 'transparent',
    color: '#0f766e', fontWeight: '700', cursor: 'pointer',
  });
  close.addEventListener('click', () => panel.remove());
  panel.appendChild(close);
  document.body.appendChild(panel);
  close.focus();
}

const detection = looksLikeAgreement();
if (detection.yes) {
  console.log('[NUDGE] agreement page detected:', detection.heading);
  injectBadge();
}
