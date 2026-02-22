/**
 * App installer — orchestrates the full install flow.
 *
 * Steps: appId → paths → downloadIcon → buildMetadata → writeDesktop → writeMetadata.
 * @module app-installer
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { generateAppId, generateAppIdFromName } from './app-id.js';
import { resolveAppPaths } from './xdg-paths.js';
import { generateDesktopEntry } from './desktop-entry.js';
import { buildAppMetadata } from './app-metadata.js';
import { downloadIcon } from './icon-downloader.js';
import { generateLetterIcon } from './icon-resolver.js';

/** @typedef {import('./app-metadata.js').AppMetadata} AppMetadata */

/**
 * @typedef {{
 *   metadata: {
 *     name: string,
 *     iconUrl: string,
 *     displayMode?: string,
 *     themeColor?: string | null,
 *     startUrl?: string | null,
 *     scope?: string | null,
 *   },
 *   classification: { level: string },
 *   finalUrl: string,
 * }} ClassifyResult
 */

/**
 * @typedef {{
 *   wrapperPath: string,
 *   customName?: string,
 * }} InstallOptions
 */

/**
 * Install a classified site as a standalone app.
 *
 * Orchestrates:
 * 1. Generate app ID from URL
 * 2. Resolve XDG paths
 * 3. Download/save icon
 * 4. Generate .desktop entry
 * 5. Write .desktop file
 * 6. Build and write metadata JSON
 *
 * @param {ClassifyResult} classifyResult - Output from classifyUrl pipeline.
 * @param {InstallOptions} options - Install options.
 * @returns {Promise<{ success: true, data: AppMetadata } | { success: false, error: string }>}
 */
export async function installApp(classifyResult, options) {
  // Step 1: Generate app ID (from custom name or URL)
  const idResult = options.customName
    ? generateAppIdFromName(options.customName)
    : generateAppId(classifyResult.finalUrl);
  if (!idResult.success) {
    return { success: false, error: `App ID: ${idResult.error}` };
  }
  const appId = idResult.data;
  const displayName = options.customName || classifyResult.metadata.name;

  // Step 2: Determine icon extension from source
  const iconSource = classifyResult.metadata.iconUrl;
  const iconExt =
    iconSource.startsWith('data:image/svg') || iconSource.includes('.svg') ? 'svg' : 'png';

  // Step 3: Resolve paths
  const pathsResult = resolveAppPaths(appId, iconExt);
  if (!pathsResult.success) {
    return { success: false, error: `Paths: ${pathsResult.error}` };
  }
  const paths = pathsResult.data;

  // Step 4: Download/save icon (with letter icon fallback)
  let iconResult = await downloadIcon(iconSource, paths.iconFile);
  if (!iconResult.success && !iconSource.startsWith('data:')) {
    // HTTP icon fetch failed (e.g. 403 from CDN) — fall back to letter icon
    const letterIcon = generateLetterIcon(displayName);
    const letterPaths = resolveAppPaths(appId, 'svg');
    if (letterPaths.success) {
      iconResult = await downloadIcon(letterIcon, letterPaths.data.iconFile);
      if (iconResult.success) {
        // Update paths to use the SVG icon file for desktop entry and metadata
        paths.iconFile = letterPaths.data.iconFile;
      }
    }
  }
  if (!iconResult.success) {
    return { success: false, error: `Icon: ${iconResult.error}` };
  }

  // Step 5: Resolve launch URL (startUrl from manifest → finalUrl)
  let launchUrl = classifyResult.finalUrl;
  if (classifyResult.metadata.startUrl) {
    try {
      launchUrl = new URL(classifyResult.metadata.startUrl, classifyResult.finalUrl).href;
    } catch {
      // Invalid startUrl — fall back to finalUrl
    }
  }

  // Step 6: Generate .desktop entry
  const desktopResult = generateDesktopEntry({
    name: displayName,
    exec: `${options.wrapperPath} ${appId} ${launchUrl}`,
    icon: paths.iconFile,
    comment: `Web app: ${launchUrl}`,
  });
  if (!desktopResult.success) {
    return { success: false, error: `Desktop entry: ${desktopResult.error}` };
  }

  // Step 7: Write .desktop file
  try {
    await mkdir(paths.applicationsDir, { recursive: true });
    await writeFile(paths.desktopFile, desktopResult.data, 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Write .desktop: ${msg}` };
  }

  // Step 8: Collect optional manifest fields (only non-null, non-browser values)
  const { displayMode, themeColor, scope } = classifyResult.metadata;
  /** @type {import('./app-metadata.js').AppMetadataInput} */
  const metaInput = {
    appId,
    name: displayName,
    url: launchUrl,
    level: classifyResult.classification.level,
    iconPath: paths.iconFile,
    desktopPath: paths.desktopFile,
    wrapperPath: options.wrapperPath,
  };
  if (displayMode && displayMode !== 'browser') metaInput.displayMode = displayMode;
  if (themeColor) metaInput.themeColor = themeColor;
  if (classifyResult.metadata.startUrl) metaInput.startUrl = launchUrl;
  if (scope) metaInput.scope = scope;

  // Step 9: Build metadata
  const metaResult = buildAppMetadata(metaInput);
  if (!metaResult.success) {
    return { success: false, error: `Metadata: ${metaResult.error}` };
  }

  // Step 8: Write metadata JSON
  try {
    await mkdir(paths.appsDir, { recursive: true });
    await writeFile(paths.metadataFile, JSON.stringify(metaResult.data, null, 2) + '\n', 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Write metadata: ${msg}` };
  }

  return { success: true, data: metaResult.data };
}
