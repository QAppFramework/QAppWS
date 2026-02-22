/**
 * Fetch and validate a web app manifest from a URL.
 * @module manifest-fetcher
 */

import { validateManifest } from './manifest-schema.js';

/** @typedef {import('./manifest-schema.js').Manifest} Manifest */

/**
 * Fetch a manifest URL, parse as JSON, validate against schema.
 * @param {string} manifestUrl - Absolute URL to the manifest file.
 * @returns {Promise<{ success: true, data: Manifest } | { success: false, error: string }>}
 */
export async function fetchManifest(manifestUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10_000);

  try {
    const response = await fetch(manifestUrl, {
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Manifest fetch failed: HTTP ${String(response.status)}`,
      };
    }

    const text = await response.text();

    /** @type {unknown} */
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { success: false, error: 'Manifest is not valid JSON' };
    }

    return validateManifest(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown fetch error';
    return { success: false, error: `Manifest fetch error: ${message}` };
  } finally {
    clearTimeout(timeout);
  }
}
