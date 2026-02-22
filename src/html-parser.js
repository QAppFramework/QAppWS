/**
 * Regex-based HTML parser for extracting PWA-relevant metadata.
 *
 * Extracts manifest link, title, icons, theme-color, and service worker
 * registration hints from HTML source. No DOM required.
 * @module html-parser
 */

/**
 * @typedef {{ href: string, sizes: string | undefined }} HtmlIcon
 * @typedef {{
 *   manifestUrl: string | null,
 *   title: string | null,
 *   icons: HtmlIcon[],
 *   themeColor: string | null,
 *   swHint: boolean
 * }} HtmlMeta
 */

/**
 * Resolve a possibly-relative URL against a base URL.
 * @param {string} href - The href to resolve.
 * @param {string} baseUrl - The base URL to resolve against.
 * @returns {string} Absolute URL.
 */
function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

/**
 * Parse HTML source for PWA-relevant metadata.
 * @param {string} html - Raw HTML source.
 * @param {string} baseUrl - Base URL for resolving relative URLs.
 * @returns {{ success: true, data: HtmlMeta } | { success: false, error: string }}
 */
export function parseHtml(html, baseUrl) {
  // Manifest link: <link rel="manifest" href="...">
  const manifestMatch = html.match(
    /<link\s+[^>]*rel=["']manifest["'][^>]*href=["']([^"']+)["'][^>]*>/i
  );
  const manifestMatch2 = html.match(
    /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']manifest["'][^>]*>/i
  );
  const manifestHref = manifestMatch?.[1] ?? manifestMatch2?.[1] ?? null;
  const manifestUrl = manifestHref ? resolveUrl(manifestHref, baseUrl) : null;

  // Title: <title>...</title>
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? null;

  // Icons: <link rel="icon" ...> and <link rel="apple-touch-icon" ...>
  /** @type {HtmlIcon[]} */
  const icons = [];
  const iconRegex = /<link\s+[^>]*rel=["'](?:icon|apple-touch-icon|shortcut icon)["'][^>]*>/gi;
  let iconMatch;
  while ((iconMatch = iconRegex.exec(html)) !== null) {
    const tag = iconMatch[0];
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    const sizesMatch = tag.match(/sizes=["']([^"']+)["']/i);
    if (hrefMatch?.[1]) {
      icons.push({
        href: resolveUrl(hrefMatch[1], baseUrl),
        sizes: sizesMatch?.[1],
      });
    }
  }

  // Theme color: <meta name="theme-color" content="...">
  const themeMatch = html.match(
    /<meta\s+[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["'][^>]*>/i
  );
  const themeMatch2 = html.match(
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["'][^>]*>/i
  );
  const themeColor = themeMatch?.[1] ?? themeMatch2?.[1] ?? null;

  // Service worker registration hint
  const swHint = /navigator\s*\.\s*serviceWorker\s*\.\s*register\s*\(/.test(html);

  return {
    success: true,
    data: { manifestUrl, title, icons, themeColor, swHint },
  };
}
