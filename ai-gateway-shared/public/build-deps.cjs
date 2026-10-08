#!/usr/bin/env node
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// deps.json format:
//   name: package name (for display)
//   cmd: shell command to run
//   cwd: (external packages) working directory relative to this file, used as execSync cwd
//   packageDir: (workspace packages) package path relative to this file, ignored by build
const deps = JSON.parse(fs.readFileSync(path.join(__dirname, "deps.json"), "utf-8"));

console.log("Building ai-gateway-shared public dependencies...\n");

for (const dep of deps) {
  console.log(`Building ${dep.name}...`);
  const cwd = dep.cwd ? path.resolve(__dirname, dep.cwd) : __dirname;
  execSync(dep.cmd, { cwd, stdio: "inherit" });
}

console.log("\nAll dependencies built successfully!");
