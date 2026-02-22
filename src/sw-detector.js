/**
 * Service worker detection.
 *
 * Uses two methods:
 * 1. HTML registration hints (from html-parser)
 * 2. Probing common service worker paths
 * @module sw-detector
 */

/** @typedef {import('./html-parser.js').HtmlMeta} HtmlMeta */

/**
 * @typedef {{
 *   detected: boolean,
 *   method: 'html-hint' | 'probe' | 'none'
 * }} SwDetectionResult
 */

const COMMON_SW_PATHS = ['/sw.js', '/service-worker.js', '/serviceworker.js'];

/**
 * Probe a URL to see if it responds (status 200 with JS content).
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function probeUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 5_000);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Detect whether a site has a service worker.
 * @param {HtmlMeta} htmlMeta - Parsed HTML metadata (may contain swHint).
 * @param {string} baseUrl - The site's base URL for probing common paths.
 * @returns {Promise<{ success: true, data: SwDetectionResult }>}
 */
export async function detectServiceWorker(htmlMeta, baseUrl) {
  // Method 1: HTML registration hint
  if (htmlMeta.swHint) {
    return {
      success: true,
      data: { detected: true, method: 'html-hint' },
    };
  }

  // Method 2: Probe common paths
  const origin = new URL(baseUrl).origin;
  for (const path of COMMON_SW_PATHS) {
    const found = await probeUrl(`${origin}${path}`);
    if (found) {
      return {
        success: true,
        data: { detected: true, method: 'probe' },
      };
    }
  }

  return {
    success: true,
    data: { detected: false, method: 'none' },
  };
}
