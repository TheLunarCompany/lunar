#!/usr/bin/env node
/* eslint-env node, es6 */

const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { execSync } = require('child_process');

if (process.argv.length < 3) {
  console.error('Usage: node run-all-with-image.cjs <docker-image>');
  process.exit(1);
}

const newImage = process.argv[2];
const testsDir = path.join(__dirname, 'tests');
const failedSuites = [];

const warningsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpx-e2e-warn-'));
const warningsFile = path.join(warningsRoot, 'warnings.ndjson');

fs.readdirSync(testsDir).forEach(suiteName => {
  const suiteDir    = path.join(testsDir, suiteName);
  const scenarioPath = path.join(suiteDir, 'scenario.yaml');

  if (!fs.existsSync(scenarioPath) || !fs.lstatSync(suiteDir).isDirectory()) {
    return; // skip non-dirs or suites without scenario.yaml
  }

  console.log(`\n=== Suite: ${suiteName} ===`);

  // Read the raw YAML text
  let text = fs.readFileSync(scenarioPath, 'utf8');

  // Replace (or insert) the top-level "image:" line
  if (/^image\s*:/m.test(text)) {
    // swap out the existing image line
    text = text.replace(
      /^image\s*:.*$/m,
      `image: ${newImage}`
    );
  } else {
    // if there's no image key at all, inject it right after the first line
    const lines = text.split('\n');
    lines.splice(1, 0, `image: ${newImage}`);
    text = lines.join('\n');
  }

  // Write it back, comments & quoting intact
  fs.writeFileSync(scenarioPath, text, 'utf8');

  // Run the scenario
  try {
    execSync(`npm run test-scenario -- tests/${suiteName}`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        MCPX_E2E_WARNINGS_FILE: warningsFile,
      },
    });
  } catch (err) {
    console.error(`  ❌  Test failed for ${suiteName}:`, err.message);
    failedSuites.push(suiteName);
  }
});

const warningEntries = readWarningsFile(warningsFile);

if (warningEntries.length) {
  console.log('\n=== Scenario warnings ===');
  for (const entry of warningEntries) {
    const location = entry.scenarioDir ? ` (${entry.scenarioDir})` : '';
    console.log(` - ${entry.scenario}${location}`);
    for (const message of entry.warnings) {
      console.log(`    • ${message}`);
    }
  }
}

if (failedSuites.length) {
  console.error('\n=== Failed suites ===');
  failedSuites.forEach((name) => console.error(` - ${name}`));
  process.exitCode = 1;
} else {
  console.log('\n🎉 All suites passed');
}

try {
  fs.rmSync(warningsRoot, { recursive: true, force: true });
} catch (err) {
  console.warn('⚠️  Failed to clean warnings temp dir:', (err && err.message) || err);
}

function readWarningsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        console.warn('⚠️  Unable to parse warnings entry:', line, (err && err.message) || err);
        return null;
      }
    })
    .filter(Boolean);
}
