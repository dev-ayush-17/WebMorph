#!/usr/bin/env node
/**
 * scripts/setup-collector.js
 *
 * One-time setup helper: creates a Bright Data Scraper Studio collector
 * and writes the resulting Collector ID to your .env file automatically.
 *
 * Usage:
 *   node scripts/setup-collector.js \
 *     --url "https://your-target-site.com/products" \
 *     --description "product name as string, price as float without currency symbol, ..."
 *
 * What it does:
 *   1. Calls `bdata scraper create <url> "<description>"`
 *   2. Parses the Collector ID from the output
 *   3. Writes BRIGHTDATA_COLLECTOR_ID and TARGET_URL to .env (creates .env from
 *      .env.example if it doesn't exist yet)
 *   4. Prints next steps
 *
 * IMPORTANT: This script makes a REAL bdata CLI call — only run it once you have:
 *   - Chosen a real target site
 *   - Written a real field description
 *   - Logged in with `bdata login`
 *
 * For mock mode (no real site yet), you do NOT need this script.
 */

'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { createCollector } = require('../src/brightdata/client');
const { CliNotAuthenticatedError, UnknownCliError } = require('../src/brightdata/errors');

// ─── Argument parsing ─────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) {
      args.url = argv[++i];
    } else if (argv[i] === '--description' && argv[i + 1]) {
      args.description = argv[++i];
    } else if (argv[i] === '--dry-run') {
      args.dryRun = true;
    } else if (argv[i] === '--help' || argv[i] === '-h') {
      args.help = true;
    }
  }
  return args;
}

function printUsage() {
  console.log(`
Usage: node scripts/setup-collector.js --url <url> --description <description>

Options:
  --url <url>               Target URL for the collector (required)
  --description <desc>      Plain-English field description (required)
  --dry-run                 Print what would happen without making any CLI call
  --help                    Show this help message

Example:
  node scripts/setup-collector.js \\
    --url "https://example.com/products" \\
    --description "product name as string, price as float without $ symbol, currency as 3-letter code, in_stock as boolean, product URL as string"

See docs/how-to-add-target-site.md for the full walkthrough.
`);
}

// ─── .env writer ─────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');

/**
 * Write (or update) BRIGHTDATA_COLLECTOR_ID and TARGET_URL in .env.
 * Creates .env from .env.example if it doesn't exist.
 */
function writeEnvVars(collectorId, targetUrl) {
  // Create .env from example if missing
  if (!fs.existsSync(ENV_FILE)) {
    if (fs.existsSync(ENV_EXAMPLE)) {
      fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
      console.log('[setup] Created .env from .env.example');
    } else {
      fs.writeFileSync(ENV_FILE, '');
      console.log('[setup] Created empty .env');
    }
  }

  let content = fs.readFileSync(ENV_FILE, 'utf8');

  // Update or append BRIGHTDATA_COLLECTOR_ID
  if (/^BRIGHTDATA_COLLECTOR_ID=/m.test(content)) {
    content = content.replace(
      /^BRIGHTDATA_COLLECTOR_ID=.*/m,
      `BRIGHTDATA_COLLECTOR_ID=${collectorId}`
    );
  } else {
    content += `\nBRIGHTDATA_COLLECTOR_ID=${collectorId}\n`;
  }

  // Update or append TARGET_URL
  if (/^TARGET_URL=/m.test(content)) {
    content = content.replace(/^TARGET_URL=.*/m, `TARGET_URL=${targetUrl}`);
  } else {
    content += `TARGET_URL=${targetUrl}\n`;
  }

  fs.writeFileSync(ENV_FILE, content, 'utf8');
  console.log(`[setup] ✓ Written to .env:`);
  console.log(`[setup]   BRIGHTDATA_COLLECTOR_ID=${collectorId}`);
  console.log(`[setup]   TARGET_URL=${targetUrl}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.url || !args.description) {
    console.error('Error: --url and --description are required.\n');
    printUsage();
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Undying Scraper — Collector Setup');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  URL:         ${args.url}`);
  console.log(`  Description: ${args.description.substring(0, 60)}...`);
  console.log('');

  if (args.dryRun) {
    console.log('[setup] DRY RUN — would run:');
    console.log(`[setup]   bdata scraper create "${args.url}" "<description>"`);
    console.log('[setup] No actual CLI call made.');
    process.exit(0);
  }

  let collectorId;
  try {
    collectorId = await createCollector(args.url, args.description);
  } catch (err) {
    if (err instanceof CliNotAuthenticatedError) {
      console.error('\n✗ Authentication error:');
      console.error(`  ${err.message}`);
      console.error('\n  Run `bdata login` first, then retry this script.');
    } else if (err instanceof UnknownCliError) {
      console.error('\n✗ Unexpected CLI error:');
      console.error(`  ${err.message}`);
      if (err.stderr) console.error(`  stderr: ${err.stderr}`);
    } else {
      console.error('\n✗ Error:', err.message);
    }
    process.exit(1);
  }

  writeEnvVars(collectorId, args.url);

  console.log('');
  console.log('───────────────────────────────────────────────────────────');
  console.log('  ✓ Setup complete!');
  console.log('');
  console.log('  Next steps:');
  console.log('  1. Verify your .env has the correct values');
  console.log('  2. Run the pipeline: node scripts/run-pipeline.js');
  console.log('  3. Check the Supabase products table for real data');
  console.log('  4. If using GitHub Actions, add BRIGHTDATA_COLLECTOR_ID');
  console.log('     and TARGET_URL to your repository secrets');
  console.log('───────────────────────────────────────────────────────────');
  console.log('');
}

main().catch((err) => {
  console.error('[setup] Unhandled error:', err);
  process.exit(1);
});
