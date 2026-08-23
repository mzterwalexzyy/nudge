/// <reference types="chrome" />
/** Hosted NUDGE connection settings. Tokens are stored only in extension storage. */

export {};

const NUDGE_API = 'https://second-brain-uio9.onrender.com';

async function init() {
  const tokenInput = document.getElementById('token') as HTMLInputElement;
  const status = document.getElementById('status') as HTMLElement;
  const stored = await chrome.storage.local.get(['captureToken']);
  tokenInput.value = stored.captureToken || '';

  document.getElementById('save')?.addEventListener('click', async () => {
    const captureToken = tokenInput.value.trim();
    if (!captureToken) {
      status.className = 'status error';
      status.textContent = 'Capture token is required.';
      return;
    }

    await chrome.storage.local.set({ apiBase: NUDGE_API, captureToken });
    status.className = 'status success';
    status.textContent = 'Connected to NUDGE.';
  });
}

void init();
