#!/usr/bin/env node

/**
 * CLI entry point for classification from pre-fetched data.
 *
 * Reads JSON from stdin, calls classifyFromData(), outputs JSON to stdout.
 * Same output contract as bin/classify.js.
 *
 * Usage: echo '{"html":"...","finalUrl":"...","isHttps":true,"manifestJson":null,"swDetected":false}' | node bin/classify-from-data.js
 * Exit 0 on success, 1 on error.
 */

import { classifyFromData } from '../src/classify-from-data.js';

/** @returns {Promise<string>} */
function readStdin() {
  return new Promise((resolve, reject) => {
    /** @type {string[]} */
    const chunks = [];
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

const raw = await readStdin();

/** @type {unknown} */
let input;
try {
  input = JSON.parse(raw);
} catch {
  process.stdout.write(JSON.stringify({ error: 'Invalid JSON on stdin' }) + '\n');
  process.exit(1);
}

const result = await classifyFromData(/** @type {any} */ (input));

if (result.success) {
  process.stdout.write(JSON.stringify(result.data, null, 2) + '\n');
  process.exit(0);
} else {
  process.stdout.write(JSON.stringify({ error: result.error }, null, 2) + '\n');
  process.exit(1);
}
