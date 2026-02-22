/**
 * App metadata builder and schema.
 *
 * Constructs the JSON metadata stored per installed app.
 * Uses Valibot for runtime validation.
 * @module app-metadata
 */

import * as v from 'valibot';

/** Valibot schema for app metadata. */
export const AppMetadataSchema = v.object({
  appId: v.pipe(v.string(), v.minLength(1)),
  name: v.pipe(v.string(), v.minLength(1)),
  url: v.pipe(v.string(), v.url()),
  level: v.picklist(['WS', 'WAPP', 'PWAPP']),
  iconPath: v.string(),
  desktopPath: v.string(),
  wrapperPath: v.string(),
  installedAt: v.pipe(v.string(), v.isoTimestamp()),
  displayMode: v.optional(v.picklist(['fullscreen', 'standalone', 'minimal-ui', 'browser'])),
  themeColor: v.optional(v.pipe(v.string(), v.minLength(1))),
  startUrl: v.optional(v.pipe(v.string(), v.minLength(1))),
  scope: v.optional(v.pipe(v.string(), v.minLength(1))),
});

/** @typedef {v.InferOutput<typeof AppMetadataSchema>} AppMetadata */

/**
 * @typedef {{
 *   appId: string,
 *   name: string,
 *   url: string,
 *   level: string,
 *   iconPath: string,
 *   desktopPath: string,
 *   wrapperPath: string,
 *   displayMode?: string,
 *   themeColor?: string,
 *   startUrl?: string,
 *   scope?: string,
 * }} AppMetadataInput
 */

/**
 * Extract error message from Valibot parse result.
 * @param {v.SafeParseResult<typeof AppMetadataSchema>} result - Failed parse result.
 * @returns {string}
 */
function formatError(result) {
  if (result.success) return '';
  const issues = result.issues;
  if (issues.length === 0) return 'Validation failed';
  const first = /** @type {NonNullable<typeof issues[0]>} */ (issues[0]);
  const pathParts = first.path;
  const pathStr = pathParts ? pathParts.map((p) => String(p.key)).join('.') : 'unknown';
  const msg = first.message;
  return `Validation failed at ${pathStr}: ${msg}`;
}

/**
 * Build app metadata with the current timestamp.
 *
 * @param {AppMetadataInput} input - Metadata fields (without installedAt).
 * @returns {{ success: true, data: AppMetadata } | { success: false, error: string }}
 */
export function buildAppMetadata(input) {
  const raw = {
    ...input,
    installedAt: new Date().toISOString(),
  };

  const result = v.safeParse(AppMetadataSchema, raw);
  if (!result.success) {
    return { success: false, error: formatError(result) };
  }

  return { success: true, data: result.output };
}

/**
 * Validate existing metadata JSON against the schema.
 *
 * @param {unknown} data - Raw parsed JSON to validate.
 * @returns {{ success: true, data: AppMetadata } | { success: false, error: string }}
 */
export function validateAppMetadata(data) {
  const result = v.safeParse(AppMetadataSchema, data);
  if (!result.success) {
    return { success: false, error: formatError(result) };
  }
  return { success: true, data: result.output };
}
