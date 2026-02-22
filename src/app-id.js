/**
 * App ID generation from URLs.
 *
 * Produces a stable, human-readable identifier from a URL's hostname.
 * Dots become hyphens, non-default ports are appended.
 * Same host = same app ID (deterministic).
 * @module app-id
 */

/**
 * Generate an app ID from a URL string.
 *
 * Rules:
 * - Hostname only (no path, query, fragment)
 * - Dots replaced with hyphens
 * - Lowercase
 * - Non-default port (not 80/443) appended with hyphen
 *
 * @param {string} url - A valid http(s) URL.
 * @returns {{ success: true, data: string } | { success: false, error: string }}
 */
export function generateAppId(url) {
  /** @type {URL} */
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { success: false, error: 'Invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { success: false, error: 'URL must use http or https protocol' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname.length === 0) {
    return { success: false, error: 'URL has no hostname' };
  }

  let appId = hostname.replaceAll('.', '-');

  // Append non-default port
  const port = parsed.port;
  if (port.length > 0) {
    appId += `-${port}`;
  }

  return { success: true, data: appId };
}

/**
 * Generate an app ID from a custom name string.
 *
 * Rules:
 * - Lowercase
 * - Non-alphanumeric characters replaced with hyphens
 * - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 *
 * @param {string} name - A human-readable app name.
 * @returns {{ success: true, data: string } | { success: false, error: string }}
 */
export function generateAppIdFromName(name) {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { success: false, error: 'App name must not be empty' };
  }

  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length === 0) {
    return { success: false, error: 'App name must contain at least one alphanumeric character' };
  }

  return { success: true, data: slug };
}
