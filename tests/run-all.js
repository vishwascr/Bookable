#!/usr/bin/env node
/**
 * Bookable E2E Master Test Runner
 * Runs the 4-tier E2E test suites using Node.js 24 native node:test
 */

import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkServerReady, API_BASE } from './helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const ALL_SUITES = [
  path.join(rootDir, 'tests/auth-isolation.test.js'),
  path.join(rootDir, 'tests/recommendation-heuristics.test.js'),
  path.join(rootDir, 'tests/sentiment-analysis.test.js'),
  path.join(rootDir, 'tests/e2e-scenarios.test.js'),
];

// Parse command line arguments
const args = process.argv.slice(2);
let targetSuites = [...ALL_SUITES];

const suiteArg = args.find((a) => a.startsWith('--suite='));
if (suiteArg) {
  const filter = suiteArg.split('=')[1].toLowerCase();
  targetSuites = ALL_SUITES.filter((s) => s.toLowerCase().includes(filter));
  if (targetSuites.length === 0) {
    console.error(`[runner] No test suite matched filter: "${filter}"`);
    console.error(`Available suites:\n  ${ALL_SUITES.map((s) => path.basename(s)).join('\n  ')}`);
    process.exit(1);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('  Bookable E2E Test Suite Runner');
  console.log(`  Target API: ${API_BASE}`);
  console.log(`  Suites to execute (${targetSuites.length}):`);
  for (const s of targetSuites) {
    console.log(`    - tests/${path.basename(s)}`);
  }
  console.log('='.repeat(70));

  // Preflight server check
  console.log('[runner] Performing preflight health check against API...');
  const isReady = await checkServerReady(20000);
  if (!isReady) {
    console.warn('\n⚠️  WARNING: Bookable server at', API_BASE, 'is not responding or index not ready.');
    console.warn('   Ensure MongoDB is running (port 27017) and Express server is active (port 5050).');
    console.warn('   Continuing test execution (unresponsive endpoints will record failure diagnostics)...\n');
  } else {
    console.log('✅ Server is ready and book index is loaded.\n');
  }

  // Tier tracking stats
  const stats = {
    T1: { total: 0, pass: 0, fail: 0 },
    T2: { total: 0, pass: 0, fail: 0 },
    T3: { total: 0, pass: 0, fail: 0 },
    T4: { total: 0, pass: 0, fail: 0 },
    other: { total: 0, pass: 0, fail: 0 },
  };

  let totalPass = 0;
  let totalFail = 0;
  const failedTestDetails = [];

  const testStream = run({
    files: targetSuites,
    concurrency: 1, // Sequential suite runs to preserve isolation
  });

  // Pipe to spec reporter for standard terminal output
  testStream.compose(new spec()).pipe(process.stdout);

  testStream.on('test:pass', (t) => {
    // Only count leaf tests, not describe blocks
    if (t.nesting === 0 && !t.name.startsWith('T1-') && !t.name.startsWith('T2-') && !t.name.startsWith('T3-') && !t.name.startsWith('T4-')) {
      return;
    }
    const match = t.name.match(/^(T[1-4])-/);
    const tier = match ? match[1] : 'other';
    if (stats[tier]) {
      stats[tier].total++;
      stats[tier].pass++;
    }
    totalPass++;
  });

  testStream.on('test:fail', (t) => {
    const match = t.name.match(/^(T[1-4])-/);
    const tier = match ? match[1] : 'other';
    if (stats[tier]) {
      stats[tier].total++;
      stats[tier].fail++;
    }
    totalFail++;
    failedTestDetails.push({
      name: t.name,
      file: t.file ? path.basename(t.file) : 'unknown',
      error: t.details?.error?.message || 'Assertion failed',
    });
  });

  testStream.on('end', () => {
    setTimeout(() => {
      console.log('\n' + '='.repeat(70));
      console.log('            E2E TEST SUITE EXECUTION SUMMARY');
      console.log('='.repeat(70));
      console.log(`  Tier 1 (Feature Coverage)           : ${stats.T1.pass} pass / ${stats.T1.fail} fail (Target: 50)`);
      console.log(`  Tier 2 (Boundary & Corner Cases)    : ${stats.T2.pass} pass / ${stats.T2.fail} fail (Target: 52)`);
      console.log(`  Tier 3 (Cross-Feature Combinations) : ${stats.T3.pass} pass / ${stats.T3.fail} fail (Target: 12)`);
      console.log(`  Tier 4 (Real-World User Scenarios)  : ${stats.T4.pass} pass / ${stats.T4.fail} fail (Target: 6)`);
      if (stats.other.total > 0) {
        console.log(`  Other / Suite Tests                 : ${stats.other.pass} pass / ${stats.other.fail} fail`);
      }
      console.log('-'.repeat(70));
      console.log(`  TOTAL RESULTS: ${totalPass} PASSED, ${totalFail} FAILED (Total Evaluated: ${totalPass + totalFail})`);
      console.log('='.repeat(70));

      if (failedTestDetails.length > 0) {
        console.log(`\n❌ Failed Tests Breakdown (${failedTestDetails.length}):`);
        for (const f of failedTestDetails.slice(0, 20)) {
          console.log(`   - [${f.file}] ${f.name}`);
          console.log(`     Error: ${f.error}`);
        }
        if (failedTestDetails.length > 20) {
          console.log(`   ... and ${failedTestDetails.length - 20} more failed tests.`);
        }
        process.exitCode = 1;
      } else {
        console.log('\n🎉 ALL EXECUTED E2E TESTS PASSED WITH 100% SUCCESS!');
        process.exitCode = 0;
      }
    }, 100);
  });
}

main().catch((err) => {
  console.error('[runner] Fatal runner error:', err);
  process.exit(1);
});
