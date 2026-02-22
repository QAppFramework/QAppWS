#!/usr/bin/env node

/**
 * CLI entry point for app uninstallation.
 *
 * Usage: node bin/uninstall.js <app-id>
 * Outputs JSON to stdout. Exit 0 on success, 1 on error.
 */

import { uninstallApp } from '../src/app-uninstaller.js';

const appId = process.argv[2];

if (!appId) {
  process.stderr.write('Usage: node bin/uninstall.js <app-id>\n');
  process.exit(1);
}

const result = await uninstallApp(appId);

if (result.success) {
  process.stdout.write(JSON.stringify(result.data, null, 2) + '\n');
  process.exit(0);
} else {
  process.stdout.write(JSON.stringify({ error: result.error }, null, 2) + '\n');
  process.exit(1);
}
