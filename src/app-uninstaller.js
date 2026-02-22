/**
 * App uninstaller — removes installed app files.
 *
 * Reads metadata JSON to find all files, then removes them.
 * @module app-uninstaller
 */

import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { validateAppMetadata } from './app-metadata.js';

/**
 * Uninstall an app by its app ID.
 *
 * Reads metadata to find .desktop, icon, and metadata files, then removes all.
 *
 * @param {string} appId - The app identifier (e.g. "github-com").
 * @returns {Promise<{ success: true, data: { removed: string[] } } | { success: false, error: string }>}
 */
export async function uninstallApp(appId) {
  if (appId.length === 0) {
    return { success: false, error: 'App ID must not be empty' };
  }

  const home = homedir();
  const metadataPath = join(home, '.local', 'share', 'qapp-framework', 'apps', `${appId}.json`);

  // Read metadata to find all files
  /** @type {string} */
  let raw;
  try {
    raw = await readFile(metadataPath, 'utf-8');
  } catch {
    return { success: false, error: `App "${appId}" is not installed` };
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false, error: 'Corrupt metadata JSON' };
  }

  const metaResult = validateAppMetadata(parsed);
  if (!metaResult.success) {
    return { success: false, error: `Invalid metadata: ${metaResult.error}` };
  }

  const meta = metaResult.data;

  // Remove files: .desktop, icon, metadata
  const filesToRemove = [meta.desktopPath, meta.iconPath, metadataPath];
  /** @type {string[]} */
  const removed = [];

  for (const filePath of filesToRemove) {
    try {
      await rm(filePath, { force: true });
      removed.push(filePath);
    } catch {
      // Ignore individual file removal errors — best effort
    }
  }

  return { success: true, data: { removed } };
}
