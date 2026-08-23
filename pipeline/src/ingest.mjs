/**
 * ingest(url) - Fetch a page and extract readable text.
 * 
 * Uses Mozilla Readability (the same algorithm Firefox Reader View uses)
 * to strip navigation, ads, and boilerplate. Handles failures gracefully.
 * 
 * Returns: { title, raw_text, ok, error? }
 */

import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';

// jsdom emits noisy "Could not parse CSS stylesheet" errors for real-world
// pages with modern CSS. These are harmless to text extraction. Route them
// to a silent virtual console so they don't pollute pipeline output.
function makeSilentConsole() {
  const vc = new VirtualConsole();
  vc.on('error', () => {});
  vc.on('jsdomError', () => {});
  return vc;
}

// Safe token budget: truncate to ~12k chars (~3k tokens) to stay well
// within free-tier context limits while keeping enough for classification.
const MAX_RAW_TEXT_CHARS = 12000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Fetch and extract readable content from a URL.
 * @param {string} url
 * @returns {Promise<{title: string, raw_text: string, ok: boolean, error?: string, url: string}>}
 */
export async function ingest(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return {
        url,
        title: '',
        raw_text: '',
        ok: false,
        error: `HTTP ${res.status} ${res.statusText}`,
      };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return {
        url,
        title: '',
        raw_text: '',
        ok: false,
        error: `Unsupported content-type: ${contentType}`,
      };
    }

    const html = await res.text();
    return extractFromHtml(html, url);
  } catch (err) {
    return {
      url,
      title: '',
      raw_text: '',
      ok: false,
      error: err.name === 'AbortError' ? 'Request timed out' : err.message,
    };
  }
}

/**
 * Extract readable text from raw HTML (also used for paste mode).
 * @param {string} html
 * @param {string} url - Used as document base URL
 */
export function extractFromHtml(html, url = 'https://localhost') {
  try {
    const dom = new JSDOM(html, { url, virtualConsole: makeSilentConsole() });
    const doc = dom.window.document;

    // Grab title before Readability mutates the DOM
    const rawTitle =
      doc.querySelector('title')?.textContent?.trim() ||
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
      doc.querySelector('h1')?.textContent?.trim() ||
      '';

    // Collect outbound links (absolute http(s)) before Readability mutates DOM.
    const links = [];
    try {
      const anchors = doc.querySelectorAll('a[href]');
      const seen = new Set();
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href) && !seen.has(href)) {
          seen.add(href);
          links.push(href);
        }
        if (links.length >= 100) break;
      }
    } catch { /* ignore link extraction errors */ }

    const reader = new Readability(doc);
    const article = reader.parse();

    let title = rawTitle;
    let text = '';

    if (article && article.textContent && article.textContent.trim().length > 50) {
      title = article.title?.trim() || rawTitle;
      text = article.textContent.trim();
    } else {
      // Fallback: strip tags from body if Readability failed
      const body = doc.querySelector('body');
      text = body ? cleanText(body.textContent || '') : '';
    }

    // Collapse whitespace and truncate
    text = text.replace(/\s+/g, ' ').trim();
    const truncated = text.length > MAX_RAW_TEXT_CHARS;
    if (truncated) {
      text = text.slice(0, MAX_RAW_TEXT_CHARS);
    }

    return {
      url,
      title: title || '(untitled)',
      raw_text: text,
      links,
      ok: text.length > 0,
      truncated,
      error: text.length === 0 ? 'No readable text extracted' : undefined,
    };
  } catch (err) {
    return {
      url,
      title: '',
      raw_text: '',
      ok: false,
      error: `Parse error: ${err.message}`,
    };
  }
}

function cleanText(s) {
  return s.replace(/\s+/g, ' ').trim();
}
