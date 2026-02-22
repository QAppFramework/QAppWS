#!/usr/bin/env node

/**
 * CLI entry point for app installation.
 *
 * Usage: node bin/install.js <url> [--wrapper-path <path>] [--name <name>]
 * Runs classifyUrl → installApp → JSON stdout.
 * Exit 0 on success, 1 on error.
 */

import { classifyUrl } from '../src/classify-pipeline.js';
import { installApp } from '../src/app-installer.js';

const args = process.argv.slice(2);
// Find URL: first arg that isn't a flag or a flag value
const flagIndices = new Set();
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--wrapper-path' || args[i] === '--name') {
    flagIndices.add(i);
    flagIndices.add(i + 1);
  }
}
const url = args.find((_, i) => !flagIndices.has(i) && !args[i].startsWith('--'));

if (!url) {
  process.stderr.write('Usage: node bin/install.js <url> [--wrapper-path <path>] [--name <name>]\n');
  process.exit(1);
}

// Parse --wrapper-path option
let wrapperPath = '/usr/bin/qapp-wrapper';
const wpIdx = args.indexOf('--wrapper-path');
if (wpIdx !== -1 && args[wpIdx + 1]) {
  wrapperPath = /** @type {string} */ (args[wpIdx + 1]);
}

// Step 1: Classify the URL
const classifyResult = await classifyUrl(url);
if (!classifyResult.success) {
  process.stdout.write(JSON.stringify({ error: classifyResult.error }, null, 2) + '\n');
  process.exit(1);
}

// Parse --name option
/** @type {string | undefined} */
let customName;
const nameIdx = args.indexOf('--name');
if (nameIdx !== -1 && args[nameIdx + 1]) {
  customName = /** @type {string} */ (args[nameIdx + 1]);
}

// Step 2: Install the app
const installResult = await installApp(classifyResult.data, { wrapperPath, customName });
if (!installResult.success) {
  process.stdout.write(JSON.stringify({ error: installResult.error }, null, 2) + '\n');
  process.exit(1);
}

process.stdout.write(JSON.stringify(installResult.data, null, 2) + '\n');
process.exit(0);
