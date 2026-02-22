#!/usr/bin/env node

/**
 * CLI entry point for app installation from pre-classified data.
 *
 * Reads classify result JSON from stdin (same shape as bin/classify.js output),
 * then installs the app. Skips the classify step entirely.
 *
 * Usage: echo '{"classification":...,"metadata":...,"finalUrl":...}' | node bin/install-from-data.js [--wrapper-path <path>] [--name <name>]
 * Exit 0 on success, 1 on error.
 */

import { installApp } from '../src/app-installer.js';

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

const args = process.argv.slice(2);

// Parse --wrapper-path option
let wrapperPath = '/usr/bin/qapp-wrapper';
const wpIdx = args.indexOf('--wrapper-path');
if (wpIdx !== -1 && args[wpIdx + 1]) {
  wrapperPath = /** @type {string} */ (args[wpIdx + 1]);
}

// Parse --name option
/** @type {string | undefined} */
let customName;
const nameIdx = args.indexOf('--name');
if (nameIdx !== -1 && args[nameIdx + 1]) {
  customName = /** @type {string} */ (args[nameIdx + 1]);
}

// Read classify result from stdin
const raw = await readStdin();

/** @type {unknown} */
let classifyResult;
try {
  classifyResult = JSON.parse(raw);
} catch {
  process.stdout.write(JSON.stringify({ error: 'Invalid JSON on stdin' }) + '\n');
  process.exit(1);
}

// Install the app using the pre-classified data
const installResult = await installApp(/** @type {any} */ (classifyResult), {
  wrapperPath,
  customName,
});

if (!installResult.success) {
  process.stdout.write(JSON.stringify({ error: installResult.error }, null, 2) + '\n');
  process.exit(1);
}

process.stdout.write(JSON.stringify(installResult.data, null, 2) + '\n');
process.exit(0);
