/**
 * checkLiveness(url) - Determine whether a URL is still reachable.
 *
 * Tries HEAD first (cheap), falls back to GET if HEAD is not allowed.
 * Marks 'dead' on 404/410 (gone). Network errors are reported as 'unknown'
 * rather than 'dead', so a transient failure doesn't wrongly kill an item.
 *
 * Returns: { alive: boolean|null, status: number|null, dead: boolean, error?: string }
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function checkLiveness(url) {
  const doFetch = async (method) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: controller.signal,
      });
      return res;
    } finally {
      clearTimeout(t);
    }
  };

  try {
    let res;
    try {
      res = await doFetch('HEAD');
      // Some servers reject HEAD with 405/501; retry with GET
      if (res.status === 405 || res.status === 501) {
        res = await doFetch('GET');
      }
    } catch {
      // HEAD failed outright; try GET
      res = await doFetch('GET');
    }

    const status = res.status;
    const dead = status === 404 || status === 410;
    return {
      alive: status >= 200 && status < 400,
      status,
      dead,
    };
  } catch (err) {
    return {
      alive: null,
      status: null,
      dead: false, // don't mark dead on transient/network error
      error: err.name === 'AbortError' ? 'timeout' : err.message,
    };
  }
}
