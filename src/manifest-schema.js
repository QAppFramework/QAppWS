/**
 * Valibot schema for W3C Web Application Manifest.
 * @see https://www.w3.org/TR/appmanifest/
 * @module manifest-schema
 */

import * as v from 'valibot';

const IconSchema = v.object({
  src: v.string(),
  sizes: v.optional(v.string()),
  type: v.optional(v.string()),
  purpose: v.optional(v.string()),
});

const ShortcutSchema = v.object({
  name: v.string(),
  url: v.string(),
  short_name: v.optional(v.string()),
  description: v.optional(v.string()),
  icons: v.optional(v.array(IconSchema)),
});

const DisplayMode = v.picklist(['fullscreen', 'standalone', 'minimal-ui', 'browser']);

/** Valibot schema for a W3C Web App Manifest. */
export const ManifestSchema = v.object({
  name: v.optional(v.string()),
  short_name: v.optional(v.string()),
  start_url: v.optional(v.string()),
  scope: v.optional(v.string()),
  display: v.optional(DisplayMode),
  icons: v.optional(v.array(IconSchema)),
  theme_color: v.optional(v.string()),
  background_color: v.optional(v.string()),
  orientation: v.optional(v.string()),
  dir: v.optional(v.string()),
  lang: v.optional(v.string()),
  id: v.optional(v.string()),
  shortcuts: v.optional(v.array(ShortcutSchema)),
});

/**
 * @typedef {v.InferOutput<typeof ManifestSchema>} Manifest
 */

/**
 * Validate raw data against the W3C manifest schema.
 * @param {unknown} data - Raw parsed JSON.
 * @returns {{ success: true, data: Manifest } | { success: false, error: string }}
 */
export function validateManifest(data) {
  const result = v.safeParse(ManifestSchema, data);
  if (result.success) {
    return { success: true, data: result.output };
  }
  return { success: false, error: result.issues[0].message };
}
