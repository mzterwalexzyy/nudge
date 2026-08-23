/** Local MVP connection settings. Tokens are stored only in extension storage. */

const DEFAULT_API = 'http://localhost:3005';

async function init() {
  const apiInput = document.getElementById('api') as HTMLInputElement;
  const tokenInput = document.getElementById('token') as HTMLInputElement;
  const status = document.getElementById('status') as HTMLElement;
  const stored = await chrome.storage.local.get(['apiBase', 'captureToken']);
  apiInput.value = stored.apiBase || DEFAULT_API;
  tokenInput.value = stored.captureToken || '';

  document.getElementById('save')?.addEventListener('click', async () => {
    let apiBase = apiInput.value.trim() || DEFAULT_API;
    try {
      const parsed = new URL(apiBase);
      if (parsed.origin !== DEFAULT_API) throw new Error();
      apiBase = parsed.origin;
    } catch {
      status.className = 'status error';
      status.textContent = 'Free MVP supports http://localhost:3005 only.';
      return;
    }

    const captureToken = tokenInput.value.trim();
    if (!captureToken) {
      status.className = 'status error';
      status.textContent = 'Capture token is required.';
      return;
    }

    await chrome.storage.local.set({ apiBase, captureToken });
    status.className = 'status success';
    status.textContent = 'Connected for local capture.';
  });
}

void init();
