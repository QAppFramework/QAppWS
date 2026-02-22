#!/usr/bin/env node

/**
 * CLI entry point for listing installed apps.
 *
 * Usage: node bin/list.js
 * Outputs JSON array to stdout. Exit 0 on success, 1 on error.
 */

import { listInstalledApps } from '../src/app-lister.js';

const result = await listInstalledApps();

if (result.success) {
  process.stdout.write(JSON.stringify(result.data, null, 2) + '\n');
  process.exit(0);
} else {
  process.stdout.write(JSON.stringify({ error: result.error }, null, 2) + '\n');
  process.exit(1);
}
