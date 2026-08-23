/**
 * Public-web-only ingestion for untrusted URLs received by the extension API.
 *
 * Unlike the CLI ingest() helper, this boundary rejects local/private targets,
 * follows redirects one hop at a time, limits bytes, and never forwards page
 * cookies. It is intended for server-side linked-page and agreement fetching.
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import { extractFromHtml } from './ingest.mjs';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_MAX_BYTES = 1_500_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REDIRECTS = 5;

function isPrivateIpv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

export function isPrivateAddress(address) {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertPublicHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are allowed');
  if (url.username || url.password) throw new Error('URL credentials are not allowed');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('Non-standard ports are not allowed');

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Local network URLs are not allowed');
  }

  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new Error('Private network URLs are not allowed');
  } else {
    const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
      throw new Error('URL resolves to a private or unavailable network address');
    }
  }

  url.hash = '';
  return url;
}

async function readLimitedBody(response, maxBytes) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new Error(`Response exceeds ${maxBytes} byte limit`);
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error(`Response exceeds ${maxBytes} byte limit`);
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

export async function safeIngest(value, opts = {}) {
  const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const requestedUrl = String(value || '');
  let current;

  try {
    current = await assertPublicHttpUrl(requestedUrl);
    for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      let response;
      try {
        response = await fetch(current, {
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
      } finally {
        clearTimeout(timeout);
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`Redirect ${response.status} had no location`);
        if (redirect === maxRedirects) throw new Error('Too many redirects');
        current = await assertPublicHttpUrl(new URL(location, current).toString());
        continue;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const contentType = (response.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error(`Unsupported content-type: ${contentType || 'unknown'}`);
      }

      const html = await readLimitedBody(response, maxBytes);
      const extracted = extractFromHtml(html, current.toString());
      return {
        ...extracted,
        requested_url: requestedUrl,
        final_url: current.toString(),
      };
    }
  } catch (error) {
    return {
      url: requestedUrl,
      requested_url: requestedUrl,
      final_url: current?.toString?.() || requestedUrl,
      title: '',
      raw_text: '',
      links: [],
      ok: false,
      error: error?.name === 'AbortError' ? 'Request timed out' : error.message,
    };
  }

  return { url: requestedUrl, title: '', raw_text: '', links: [], ok: false, error: 'Fetch failed' };
}

export function selectOutboundLink(links = []) {
  for (const value of links) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      const host = url.hostname.toLowerCase();
      if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) continue;
      return url.toString();
    } catch {
      // Invalid links are ignored; the captured tweet remains the fallback.
    }
  }
  return null;
}
