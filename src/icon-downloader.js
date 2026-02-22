/**
 * Icon downloader for app installation.
 *
 * Handles saving icons from data URIs or HTTP URLs to disk.
 * Creates parent directories as needed.
 * @module icon-downloader
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Determine icon format from a data URI or URL.
 * @param {string} source - data URI or URL string.
 * @returns {string} File extension (svg, png, ico).
 */
function detectFormat(source) {
  if (source.startsWith('data:image/svg')) return 'svg';
  if (source.startsWith('data:image/png')) return 'png';
  if (source.startsWith('data:image/x-icon') || source.startsWith('data:image/vnd.microsoft.icon'))
    return 'ico';
  // For HTTP URLs, check extension
  try {
    const pathname = new URL(source).pathname.toLowerCase();
    if (pathname.endsWith('.svg')) return 'svg';
    if (pathname.endsWith('.ico')) return 'ico';
    if (pathname.endsWith('.webp')) return 'webp';
  } catch {
    // Not a valid URL — default to png
  }
  return 'png';
}

/**
 * Save a data URI to a file.
 * @param {string} dataUri - The data URI (data:image/...).
 * @param {string} destPath - Destination file path.
 * @returns {Promise<void>}
 */
async function saveDataUri(dataUri, destPath) {
  // data:image/svg+xml,<encoded> or data:image/svg+xml;base64,<data>
  const commaIndex = dataUri.indexOf(',');
  if (commaIndex === -1) throw new Error('Invalid data URI: no comma separator');

  const meta = dataUri.slice(0, commaIndex);
  const payload = dataUri.slice(commaIndex + 1);

  if (meta.includes(';base64')) {
    const buffer = Buffer.from(payload, 'base64');
    await writeFile(destPath, buffer);
  } else {
    // URL-encoded content (common for SVG)
    const decoded = decodeURIComponent(payload);
    await writeFile(destPath, decoded, 'utf-8');
  }
}

/**
 * Download an icon from a URL and save it to disk.
 * @param {string} url - The URL to fetch.
 * @param {string} destPath - Destination file path.
 * @returns {Promise<void>}
 */
async function fetchAndSave(url, destPath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${String(response.status)}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(destPath, buffer);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Download or decode an icon and save it to disk.
 *
 * Handles:
 * - `data:image/svg+xml,...` → decode + save as .svg
 * - `data:image/png;base64,...` → decode + save as .png
 * - HTTP(S) URL → fetch + save
 *
 * Creates parent directories with recursive mkdir.
 *
 * @param {string} iconSource - Data URI or HTTP URL of the icon.
 * @param {string} destPath - Destination file path on disk.
 * @returns {Promise<{ success: true, data: { path: string, format: string } } | { success: false, error: string }>}
 */
export async function downloadIcon(iconSource, destPath) {
  if (iconSource.length === 0) {
    return { success: false, error: 'Icon source must not be empty' };
  }

  const format = detectFormat(iconSource);

  try {
    // Ensure parent directory exists
    await mkdir(dirname(destPath), { recursive: true });

    if (iconSource.startsWith('data:')) {
      await saveDataUri(iconSource, destPath);
    } else {
      await fetchAndSave(iconSource, destPath);
    }

    return { success: true, data: { path: destPath, format } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Failed to save icon: ${message}` };
  }
}
