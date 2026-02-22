/**
 * Freedesktop .desktop entry file generation.
 *
 * Generates valid .desktop file content per the freedesktop Desktop Entry spec.
 * @module desktop-entry
 */

/**
 * @typedef {{
 *   name: string,
 *   exec: string,
 *   icon: string,
 *   comment?: string,
 *   categories?: string,
 * }} DesktopEntryInput
 */

/**
 * Generate a freedesktop .desktop entry file content string.
 *
 * @param {DesktopEntryInput} input - Desktop entry fields.
 * @returns {{ success: true, data: string } | { success: false, error: string }}
 */
export function generateDesktopEntry(input) {
  if (input.name.length === 0) {
    return { success: false, error: 'Name is required' };
  }
  if (input.exec.length === 0) {
    return { success: false, error: 'Exec is required' };
  }
  if (input.icon.length === 0) {
    return { success: false, error: 'Icon is required' };
  }

  const lines = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${input.name}`,
    `Exec=${input.exec}`,
    `Icon=${input.icon}`,
    'Terminal=false',
    'StartupNotify=true',
  ];

  if (input.comment && input.comment.length > 0) {
    lines.push(`Comment=${input.comment}`);
  }

  lines.push(`Categories=${input.categories ?? 'Network;WebBrowser;'}`);

  // Trailing newline per spec
  return { success: true, data: lines.join('\n') + '\n' };
}
