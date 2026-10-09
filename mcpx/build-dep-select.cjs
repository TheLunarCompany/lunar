#!/usr/bin/env node
const prompts = require("prompts");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const deps = JSON.parse(fs.readFileSync(path.join(__dirname, "deps.json"), "utf-8"));
const choices = deps.map((dep) => ({
  title: dep.name,
  value: { cmd: dep.cmd, cwd: dep.cwd },
}));

async function main() {
  const response = await prompts({
    type: "select",
    name: "dep",
    message: "Select dependency to build",
    choices,
  });

  if (!response.dep) {
    console.log("Cancelled");
    process.exit(0);
  }

  const { cmd, cwd } = response.dep;
  const execCwd = cwd ? path.resolve(__dirname, cwd) : __dirname;

  console.log(`\nBuilding in ${execCwd}...`);
  console.log(`Running: ${cmd}\n`);

  execSync(cmd, { cwd: execCwd, stdio: "inherit" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
