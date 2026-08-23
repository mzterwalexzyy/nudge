/** Authenticated bridge from page content scripts to the hosted NUDGE API. */

const API_BASE_DEFAULT = 'https://second-brain-uio9.onrender.com';

type Settings = { captureToken: string };

async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(['captureToken']);
  return {
    captureToken: typeof stored.captureToken === 'string' ? stored.captureToken : '',
  };
}

async function postIngest(payload: unknown) {
  const { captureToken } = await getSettings();
  if (!captureToken) {
    return { ok: false, status: 401, error: 'Open the extension and save your capture token first.' };
  }

  try {
    const response = await fetch(`${API_BASE_DEFAULT}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${captureToken}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    return {
      ok: response.ok && !!result.ok,
      status: response.status,
      result,
      error: response.ok ? result.error : result.error || `HTTP ${response.status}`,
    };
  } catch (error) {
    return { ok: false, status: 0, error: String(error) };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'CAPTURE') {
    postIngest(message.capture).then(sendResponse);
    return true;
  }

  if (message?.type === 'ANALYZE_AGREEMENT') {
    postIngest({
      url: message.url,
      source: 'agreement',
      title: message.title,
      text: message.text,
      links: [],
      bookmarked_at: new Date().toISOString(),
    }).then(sendResponse);
    return true;
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[NUDGE] installed. Paste a Profile connection token, then native X bookmark capture is ready.');
});
