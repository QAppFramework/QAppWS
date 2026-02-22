/**
 * App lister — lists all installed apps.
 *
 * Reads metadata JSON files from the apps directory, validates each,
 * and returns a sorted list.
 * @module app-lister
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { validateAppMetadata } from './app-metadata.js';
import { recoverApps } from './app-recovery.js';

/** @typedef {import('./app-metadata.js').AppMetadata} AppMetadata */

/**
 * List all installed apps.
 *
 * Reads all .json files from ~/.local/share/qapp-framework/apps/,
 * validates each against the metadata schema,
 * and returns them sorted by name.
 *
 * @returns {Promise<{ success: true, data: AppMetadata[] } | { success: false, error: string }>}
 */
export async function listInstalledApps() {
  // Auto-recover: rebuild metadata from .desktop files if missing
  await recoverApps();

  const appsDir = join(homedir(), '.local', 'share', 'qapp-framework', 'apps');

  /** @type {string[]} */
  let entries;
  try {
    entries = await readdir(appsDir);
  } catch {
    // Directory doesn't exist → no apps installed
    return { success: true, data: [] };
  }

  const jsonFiles = entries.filter((f) => f.endsWith('.json'));

  /** @type {AppMetadata[]} */
  const apps = [];

  for (const file of jsonFiles) {
    try {
      const raw = await readFile(join(appsDir, file), 'utf-8');
      /** @type {unknown} */
      const parsed = JSON.parse(raw);
      const result = validateAppMetadata(parsed);
      if (result.success) {
        apps.push(result.data);
      }
      // Skip invalid metadata files silently
    } catch {
      // Skip files that can't be read or parsed
    }
  }

  // Sort by name (case-insensitive)
  apps.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  return { success: true, data: apps };
}
