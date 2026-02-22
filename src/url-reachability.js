/**
 * Check URL reachability using Node.js fetch.
 *
 * Attempts HEAD first, falls back to GET. Follows redirects.
 * @module url-reachability
 */

/**
 * @typedef {{
 *   reachable: boolean,
 *   finalUrl: string,
 *   isHttps: boolean,
 *   statusCode: number,
 *   redirected: boolean
 * }} ReachabilityInfo
 */

/**
 * Check whether a URL is reachable.
 * @param {string} url - The URL to check.
 * @returns {Promise<{ success: true, data: ReachabilityInfo } | { success: false, error: string }>}
 */
export async function checkReachability(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10_000);

  try {
    // Try HEAD first (lighter)
    let response;
    try {
      response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      });
    } catch {
      // Some servers reject HEAD — fall back to GET
      response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      });
    }

    const finalUrl = response.url;
    return {
      success: true,
      data: {
        reachable: response.ok,
        finalUrl,
        isHttps: finalUrl.startsWith('https://'),
        statusCode: response.status,
        redirected: response.redirected,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown fetch error';
    return { success: false, error: `Unreachable: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}
