#!/usr/bin/env node

/**
 * CLI entry point for URL classification.
 *
 * Usage: node bin/classify.js <url>
 * Outputs JSON to stdout. Exit 0 on success, 1 on error.
 */

import { classifyUrl } from '../src/classify-pipeline.js';

const url = process.argv[2];

if (!url) {
  process.stderr.write('Usage: node bin/classify.js <url>\n');
  process.exit(1);
}

const result = await classifyUrl(url);

if (result.success) {
  process.stdout.write(JSON.stringify(result.data, null, 2) + '\n');
  process.exit(0);
} else {
  process.stdout.write(JSON.stringify({ error: result.error }, null, 2) + '\n');
  process.exit(1);
}
