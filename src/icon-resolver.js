/**
 * Icon resolution with three-level fallback.
 *
 * Fallback chain:
 * 1. Existing iconUrl (from manifest or HTML) — returned as-is
 * 2. Probe /favicon.ico at domain root — most sites have this (PNG/ICO)
 * 3. Generate letter icon (SVG) from site name with deterministic color
 * 4. Default generic app icon (SVG) as absolute last resort
 *
 * Note: favicons are typically small PNG or ICO files. The generated
 * letter and default icons are SVG data URIs for vector-quality display
 * at any size. Qt can render both formats.
 * @module icon-resolver
 */

/**
 * Simple hash to derive a hue from a string (deterministic color).
 * @param {string} str
 * @returns {number} Hue value 0-359.
 */
function hashToHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

/**
 * Generate an SVG letter icon as a data URI.
 * Uses first letter of name, white on a deterministic HSL background.
 * @param {string} name - Site name to derive letter and color from.
 * @returns {string} data:image/svg+xml;base64,... URI.
 */
export function generateLetterIcon(name) {
  const letter = name.length > 0 ? (name[0]?.toUpperCase() ?? '?') : '?';
  const hue = hashToHue(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="32" fill="hsl(${String(hue)}, 55%, 45%)"/><text x="96" y="96" dy="0.35em" text-anchor="middle" font-family="sans-serif" font-size="110" font-weight="bold" fill="white">${letter}</text></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** Default generic app icon (globe symbol) as SVG data URI. */
export const DEFAULT_ICON = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="32" fill="#607d8b"/><circle cx="96" cy="96" r="56" fill="none" stroke="white" stroke-width="6"/><ellipse cx="96" cy="96" rx="28" ry="56" fill="none" stroke="white" stroke-width="4"/><line x1="40" y1="96" x2="152" y2="96" stroke="white" stroke-width="4"/><line x1="96" y1="40" x2="96" y2="152" stroke="white" stroke-width="4"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
})();

/**
 * Probe a URL to check if a favicon exists.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function probeFavicon(url) {
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
    if (!response.ok) return false;
    // Verify it's an image (not an HTML error page)
    const ct = response.headers.get('content-type') ?? '';
    return ct.startsWith('image/') || ct.includes('octet-stream');
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve an icon URL through the fallback chain.
 *
 * 1. If iconUrl is already set → return it
 * 2. Probe /favicon.ico at origin → return origin + /favicon.ico
 * 3. Generate letter icon from name → return SVG data URI
 * 4. Default icon → return SVG data URI
 *
 * @param {string | null} iconUrl - Existing icon URL (from manifest/HTML).
 * @param {string} finalUrl - The site's final URL (after redirects).
 * @param {string} name - Site name (for letter icon generation).
 * @returns {Promise<string>} Resolved icon URL (always non-null).
 */
export async function resolveIcon(iconUrl, finalUrl, name) {
  // Level 1: existing icon
  if (iconUrl) return iconUrl;

  // Level 2: probe /favicon.ico
  try {
    const origin = new URL(finalUrl).origin;
    const faviconUrl = `${origin}/favicon.ico`;
    const found = await probeFavicon(faviconUrl);
    if (found) return faviconUrl;
  } catch {
    // Invalid URL — fall through
  }

  // Level 3: letter icon
  if (name.length > 0) {
    return generateLetterIcon(name);
  }

  // Level 4: default icon
  return DEFAULT_ICON;
}
