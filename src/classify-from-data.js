/**
 * Classification from pre-fetched data.
 *
 * Stripped-down classify pipeline that accepts data already fetched by
 * WebEngine (or any other source). Skips network steps (reachability,
 * HTML fetch, manifest fetch, SW probe). Reuses existing pure functions.
 * @module classify-from-data
 */

import { isValidUrl } from './url-validator.js';
import { parseHtml } from './html-parser.js';
import { validateManifest } from './manifest-schema.js';
import { classifySite } from './site-classifier.js';
import { extractMetadata } from './metadata-extractor.js';
import { resolveIcon } from './icon-resolver.js';

/** @typedef {import('./manifest-schema.js').Manifest} Manifest */
/** @typedef {import('./site-classifier.js').Classification} Classification */
/** @typedef {import('./metadata-extractor.js').DisplayMetadata} DisplayMetadata */

/**
 * @typedef {{
 *   html: string,
 *   finalUrl: string,
 *   isHttps: boolean,
 *   manifestJson: object | null,
 *   swDetected: boolean,
 * }} PreFetchedData
 */

/**
 * @typedef {{
 *   classification: Classification,
 *   metadata: DisplayMetadata,
 *   finalUrl: string,
 *   isHttps: boolean,
 *   manifest: Manifest | null,
 * }} PipelineResult
 */

/**
 * Classify a site from pre-fetched data.
 * @param {PreFetchedData} input - Data already fetched by WebEngine or other source.
 * @returns {Promise<{ success: true, data: PipelineResult } | { success: false, error: string }>}
 */
export async function classifyFromData(input) {
  const { html, finalUrl, isHttps, manifestJson, swDetected } = input;

  // Step 1: Validate URL format
  if (!isValidUrl(finalUrl)) {
    return { success: false, error: 'Invalid URL format' };
  }

  // Step 2: Parse HTML
  const parseResult = parseHtml(html, finalUrl);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }
  const htmlMeta = parseResult.data;

  // Step 3: Validate manifest (if provided)
  /** @type {Manifest | null} */
  let manifest = null;
  if (manifestJson !== null && typeof manifestJson === 'object') {
    const manifestResult = validateManifest(manifestJson);
    if (manifestResult.success) {
      manifest = manifestResult.data;
    }
    // If validation fails, treat as no manifest
  }

  // Step 4: Classify
  const classResult = classifySite({ manifest, sw: swDetected });
  const classification = classResult.data;

  // Step 5: Extract metadata
  const metaResult = extractMetadata({ manifest, htmlMeta, finalUrl });
  if (!metaResult.success) {
    return { success: false, error: metaResult.error };
  }
  const metadata = metaResult.data;

  // Step 6: Resolve icon (fallback chain — icon fetch usually works even for bot-protected sites)
  metadata.iconUrl = await resolveIcon(metadata.iconUrl, finalUrl, metadata.name);

  return {
    success: true,
    data: {
      classification,
      metadata,
      finalUrl,
      isHttps,
      manifest,
    },
  };
}
