#!/usr/bin/env node
/* eslint-env node, es6 */

const fs       = require('fs');
const path     = require('path');
const { execSync } = require('child_process');

if (process.argv.length < 3) {
  console.error('Usage: node run-all-with-image.cjs <docker-image>');
  process.exit(1);
}

const newImage = process.argv[2];
const testsDir = path.join(__dirname, 'tests');

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
    execSync(`npm run test-scenario -- tests/${suiteName}`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`  ❌  Test failed for ${suiteName}:`, err.message);
  }
});