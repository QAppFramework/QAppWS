/**
 * Full classification pipeline.
 *
 * Orchestrates: validate → reachability → fetch HTML → parse → manifest → SW → classify → metadata.
 * @module classify-pipeline
 */

import { isValidUrl } from './url-validator.js';
import { checkReachability } from './url-reachability.js';
import { parseHtml } from './html-parser.js';
import { fetchManifest } from './manifest-fetcher.js';
import { detectServiceWorker } from './sw-detector.js';
import { classifySite } from './site-classifier.js';
import { extractMetadata } from './metadata-extractor.js';
import { resolveIcon } from './icon-resolver.js';

/** @typedef {import('./manifest-schema.js').Manifest} Manifest */
/** @typedef {import('./site-classifier.js').Classification} Classification */
/** @typedef {import('./metadata-extractor.js').DisplayMetadata} DisplayMetadata */

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
 * Classify a URL through the full pipeline.
 * @param {string} url - The URL to classify.
 * @returns {Promise<{ success: true, data: PipelineResult } | { success: false, error: string }>}
 */
export async function classifyUrl(url) {
  // Step 1: Validate URL format
  if (!isValidUrl(url)) {
    return { success: false, error: 'Invalid URL format' };
  }

  // Step 2: Check reachability
  const reachResult = await checkReachability(url);
  if (!reachResult.success) {
    return { success: false, error: reachResult.error };
  }
  if (!reachResult.data.reachable) {
    return {
      success: false,
      error: `Site not reachable: HTTP ${String(reachResult.data.statusCode)}`,
    };
  }

  const { finalUrl, isHttps } = reachResult.data;

  // Step 3: Fetch HTML content
  /** @type {string} */
  let html;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 10_000);
    try {
      const response = await fetch(finalUrl, {
        signal: controller.signal,
        redirect: 'follow',
      });
      html = await response.text();
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: `Failed to fetch HTML: ${message}` };
  }

  // Step 4: Parse HTML
  const parseResult = parseHtml(html, finalUrl);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error };
  }
  const htmlMeta = parseResult.data;

  // Step 5: Fetch manifest (if link found)
  /** @type {Manifest | null} */
  let manifest = null;
  if (htmlMeta.manifestUrl) {
    const manifestResult = await fetchManifest(htmlMeta.manifestUrl);
    if (manifestResult.success) {
      manifest = manifestResult.data;
    }
    // If manifest fetch fails, we continue — site just won't have manifest data
  }

  // Step 6: Detect service worker
  const swResult = await detectServiceWorker(htmlMeta, finalUrl);
  const swDetected = swResult.data.detected;

  // Step 7: Classify
  const classResult = classifySite({ manifest, sw: swDetected });
  const classification = classResult.data;

  // Step 8: Extract metadata
  const metaResult = extractMetadata({ manifest, htmlMeta, finalUrl });
  if (!metaResult.success) {
    return { success: false, error: metaResult.error };
  }
  const metadata = metaResult.data;

  // Step 9: Resolve icon (fallback chain: manifest → HTML → /favicon.ico → letter → default)
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
