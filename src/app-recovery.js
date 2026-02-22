/**
 * App recovery — rebuilds metadata from surviving .desktop files.
 *
 * After QApp reinstall, metadata JSONs may be gone but .desktop files
 * in ~/.local/share/applications/ survive. This module scans them
 * and reconstructs the metadata.
 *
 * @module app-recovery
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * Parse a .desktop file and extract app fields.
 *
 * @param {string} content - Raw .desktop file content.
 * @returns {{ name: string, appId: string, url: string, wrapperPath: string, iconPath: string } | null}
 */
function parseDesktopFile(content) {
  /** @type {Record<string, string>} */
  const fields = {};

  for (const line of content.split('\n')) {
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    fields[key] = value;
  }

  const exec = fields['Exec'] || '';
  // Format: /path/to/qapp-wrapper <app-id> <url>
  const parts = exec.split(/\s+/);
  if (parts.length < 3) return null;

  const wrapperPath = /** @type {string} */ (parts[0]);
  const appId = /** @type {string} */ (parts[1]);
  const url = /** @type {string} */ (parts[2]);

  if (!appId || !url) return null;

  return {
    name: fields['Name'] || appId,
    appId,
    url,
    wrapperPath,
    iconPath: fields['Icon'] || '',
  };
}

/**
 * Scan .desktop files and rebuild missing metadata JSONs.
 *
 * @param {{ homeDir?: string }} [options]
 * @returns {Promise<{ success: true, data: { recovered: string[] } } | { success: false, error: string }>}
 */
export async function recoverApps(options = {}) {
  const home = options.homeDir || homedir();
  const desktopDir = join(home, '.local', 'share', 'applications');
  const appsDir = join(home, '.local', 'share', 'qapp-framework', 'apps');

  // Ensure apps dir exists
  await mkdir(appsDir, { recursive: true });

  // Read .desktop files
  /** @type {string[]} */
  let files;
  try {
    files = await readdir(desktopDir);
  } catch {
    return { success: true, data: { recovered: [] } };
  }

  const qappFiles = files.filter((f) => f.startsWith('qapp-') && f.endsWith('.desktop'));

  /** @type {string[]} */
  const recovered = [];

  for (const filename of qappFiles) {
    // Extract app-id from filename: qapp-{appId}.desktop
    const appId = filename.slice('qapp-'.length, -'.desktop'.length);

    // Skip if metadata already exists
    const metaPath = join(appsDir, `${appId}.json`);
    try {
      await stat(metaPath);
      continue; // exists, skip
    } catch {
      // doesn't exist, recover
    }

    // Parse .desktop file
    const content = await readFile(join(desktopDir, filename), 'utf-8');
    const parsed = parseDesktopFile(content);
    if (!parsed) continue;

    // Build metadata
    const metadata = {
      appId: parsed.appId,
      name: parsed.name,
      url: parsed.url,
      level: 'WS',
      iconPath: parsed.iconPath,
      desktopPath: join(desktopDir, filename),
      wrapperPath: parsed.wrapperPath,
      installedAt: new Date().toISOString(),
    };

    await writeFile(metaPath, JSON.stringify(metadata, null, 2));
    recovered.push(appId);
  }

  return { success: true, data: { recovered } };
}
