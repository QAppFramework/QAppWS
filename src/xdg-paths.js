/**
 * XDG path resolution for installed apps.
 *
 * Computes freedesktop-compliant paths for .desktop files, icons,
 * and app metadata based on an app ID.
 * @module xdg-paths
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * @typedef {{
 *   desktopFile: string,
 *   iconFile: string,
 *   metadataFile: string,
 *   iconsDir: string,
 *   appsDir: string,
 *   applicationsDir: string,
 * }} AppPaths
 */

/**
 * Resolve XDG paths for an installed app.
 *
 * Paths:
 * - .desktop → ~/.local/share/applications/qapp-{appId}.desktop
 * - Icon → ~/.local/share/qapp-framework/icons/{appId}.{ext}
 * - Metadata → ~/.local/share/qapp-framework/apps/{appId}.json
 *
 * @param {string} appId - The app identifier (e.g. "github-com").
 * @param {string} [iconExt="png"] - Icon file extension (png, svg, ico).
 * @returns {{ success: true, data: AppPaths } | { success: false, error: string }}
 */
export function resolveAppPaths(appId, iconExt = 'png') {
  if (appId.length === 0) {
    return { success: false, error: 'App ID must not be empty' };
  }

  const home = homedir();
  const localShare = join(home, '.local', 'share');
  const applicationsDir = join(localShare, 'applications');
  const qappBase = join(localShare, 'qapp-framework');
  const iconsDir = join(qappBase, 'icons');
  const appsDir = join(qappBase, 'apps');

  return {
    success: true,
    data: {
      desktopFile: join(applicationsDir, `qapp-${appId}.desktop`),
      iconFile: join(iconsDir, `${appId}.${iconExt}`),
      metadataFile: join(appsDir, `${appId}.json`),
      iconsDir,
      appsDir,
      applicationsDir,
    },
  };
}
