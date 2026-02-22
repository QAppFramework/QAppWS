#!/usr/bin/env node

/**
 * CLI entry point for checking installed apps for updates.
 *
 * Usage: node bin/check-updates.js
 * Checks all installed WAPP/PWAPP apps for manifest changes.
 * Outputs JSON array: [{ appId, name, hasUpdate, changes, error? }]
 * Exit 0 on success, 1 on error.
 */

import { listInstalledApps } from '../src/app-lister.js';
import { checkAppUpdate } from '../src/app-update-checker.js';

const listResult = await listInstalledApps();
if (!listResult.success) {
  process.stdout.write(JSON.stringify({ error: listResult.error }, null, 2) + '\n');
  process.exit(1);
}

// Only check apps that have manifests (WAPP/PWAPP)
const appsToCheck = listResult.data.filter((a) => a.level === 'WAPP' || a.level === 'PWAPP');

/** @type {Array<{ appId: string, name: string, hasUpdate: boolean, changes: string[], error?: string }>} */
const results = [];

for (const app of appsToCheck) {
  const result = await checkAppUpdate(app);
  if (result.success) {
    results.push({
      appId: app.appId,
      name: app.name,
      hasUpdate: result.data.hasUpdate,
      changes: result.data.changes,
    });
  } else {
    results.push({
      appId: app.appId,
      name: app.name,
      hasUpdate: false,
      changes: [],
      error: result.error,
    });
  }
}

process.stdout.write(JSON.stringify(results, null, 2) + '\n');
process.exit(0);
