/**
 * Extract display metadata from manifest and HTML meta, using a fallback chain.
 *
 * Priority: manifest fields → HTML meta → hostname.
 * @module metadata-extractor
 */

/** @typedef {import('./manifest-schema.js').Manifest} Manifest */
/** @typedef {import('./html-parser.js').HtmlMeta} HtmlMeta */

/**
 * @typedef {{
 *   name: string,
 *   iconUrl: string | null,
 *   displayMode: string,
 *   themeColor: string | null,
 *   startUrl: string | null,
 *   scope: string | null,
 * }} DisplayMetadata
 */

/**
 * Parse the first dimension from a sizes string like "192x192".
 * @param {string | undefined} sizes
 * @returns {number}
 */
function parseSize(sizes) {
  if (!sizes) return 0;
  const match = sizes.match(/^(\d+)x/);
  return match ? Number(match[1]) : 0;
}

/**
 * Pick the best icon from a manifest icons array.
 * Prefers 192px, then largest available.
 * @param {Array<{ src: string, sizes?: string | undefined }>} icons
 * @returns {string | null}
 */
function pickManifestIcon(icons) {
  if (icons.length === 0) return null;
  const target = icons.find((i) => parseSize(i.sizes) === 192);
  if (target) return target.src;
  const sorted = [...icons].sort((a, b) => parseSize(b.sizes) - parseSize(a.sizes));
  return sorted[0]?.src ?? null;
}

/**
 * Extract display metadata using a fallback chain.
 * @param {{ manifest: Manifest | null, htmlMeta: HtmlMeta, finalUrl: string }} input
 * @returns {{ success: true, data: DisplayMetadata } | { success: false, error: string }}
 */
export function extractMetadata({ manifest, htmlMeta, finalUrl }) {
  // Name: manifest.name → short_name → title → hostname
  const name =
    manifest?.name ?? manifest?.short_name ?? htmlMeta.title ?? new URL(finalUrl).hostname;

  // Icon: manifest icons (prefer 192px) → HTML favicon
  let iconUrl = null;
  if (manifest?.icons && manifest.icons.length > 0) {
    iconUrl = pickManifestIcon(manifest.icons);
  } else if (htmlMeta.icons.length > 0) {
    iconUrl = htmlMeta.icons[0]?.href ?? null;
  }

  // Display: manifest → browser (spec default when no manifest)
  const displayMode = manifest?.display ?? 'browser';

  // Theme color: manifest → HTML meta
  const themeColor = manifest?.theme_color ?? htmlMeta.themeColor ?? null;

  // Start URL from manifest
  const startUrl = manifest?.start_url ?? null;

  // Scope from manifest
  const scope = manifest?.scope ?? null;

  return {
    success: true,
    data: { name, iconUrl, displayMode, themeColor, startUrl, scope },
  };
}
