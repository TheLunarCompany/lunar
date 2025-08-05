// run-all-scenarios.js
var execSync = require('child_process').execSync;
var readdirSync = require('fs').readdirSync;
var lstatSync  = require('fs').lstatSync;
var join       = require('path').join;

var testsDir = join(__dirname, 'tests');
var entries  = readdirSync(testsDir);

entries.forEach(function(name) {
  var fullPath = join(testsDir, name);
  if (lstatSync(fullPath).isDirectory()) {
    console.log('\n➡️  Running test suite: ' + name + '\n');
    execSync('npm run test-scenario -- tests/' + name, { stdio: 'inherit' });
  }
});