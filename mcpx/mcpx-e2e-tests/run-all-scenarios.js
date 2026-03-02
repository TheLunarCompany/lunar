// run-all-scenarios.js
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const testsDir = path.join(__dirname, 'tests');
const entries = fs.readdirSync(testsDir);
const failedSuites = [];

const warningsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpx-e2e-warn-'));
const warningsFile = path.join(warningsRoot, 'warnings.ndjson');

entries.forEach(function (name) {
  const fullPath = path.join(testsDir, name);
  if (fs.lstatSync(fullPath).isDirectory()) {
    console.log('\n➡️  Running test suite: ' + name + '\n');
    try {
      execSync('npm run test-scenario -- tests/' + name, {
        stdio: 'inherit',
        env: {
          ...process.env,
          MCPX_E2E_WARNINGS_FILE: warningsFile,
        },
      });
    } catch (err) {
      console.error('❌  Test failed for ' + name + ': ' + err.message);
      failedSuites.push(name);
    }
  }
});

const warningEntries = readWarningsFile(warningsFile);

if (warningEntries.length) {
  console.log('\n=== Scenario warnings ===');
  warningEntries.forEach(function (entry) {
    const location = entry.scenarioDir ? ' (' + entry.scenarioDir + ')' : '';
    console.log(' - ' + entry.scenario + location);
    entry.warnings.forEach(function (message) {
      console.log('    • ' + message);
    });
  });
}

if (failedSuites.length) {
  console.error('\n=== Failed suites ===');
  failedSuites.forEach(function (name) {
    console.error(' - ' + name);
  });
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
    .map(function (line) {
      return line.trim();
    })
    .filter(function (line) {
      return Boolean(line);
    })
    .map(function (line) {
      try {
        return JSON.parse(line);
      } catch (err) {
        console.warn('⚠️  Unable to parse warnings entry:', line, (err && err.message) || err);
        return null;
      }
    })
    .filter(function (entry) {
      return entry;
    });
}
