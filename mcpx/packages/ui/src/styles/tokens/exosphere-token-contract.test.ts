import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (path: string) => {
  const absolutePath = resolve(process.cwd(), path);

  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
};

const requiredTokens = [
  "--mcpx-page",
  "--mcpx-surface",
  "--mcpx-surface-subtle",
  "--mcpx-surface-tertiary",
  "--mcpx-surface-hover",
  "--mcpx-text",
  "--mcpx-text-secondary",
  "--mcpx-text-tertiary",
  "--mcpx-text-disabled",
  "--mcpx-text-inverse",
  "--mcpx-border",
  "--mcpx-border-subtle",
  "--mcpx-focus",
  "--mcpx-selected",
  "--mcpx-selected-hover",
  "--mcpx-selected-weak",
  "--mcpx-action",
  "--mcpx-action-hover",
  "--mcpx-success-bg",
  "--mcpx-success-text",
  "--mcpx-warning-bg",
  "--mcpx-warning-strong",
  "--mcpx-danger-bg",
  "--mcpx-danger-text",
  "--mcpx-danger-action",
  "--mcpx-info-bg",
  "--mcpx-info-text",
  "--mcpx-scrim",
  "--mcpx-shadow-weak",
  "--mcpx-shadow-moderate",
  "--mcpx-shadow-strong",
];

describe("Exosphere token contract", () => {
  it("defines every MCPX semantic token through an Exosphere variable", () => {
    const source = readSource("src/styles/tokens/exosphere.css");

    for (const token of requiredTokens) {
      expect(source).toMatch(new RegExp(`${token}:\\s*var\\(--exo-[^)]+\\)`));
    }
  });

  it("imports Exosphere before the MCPX theme", () => {
    const source = readSource("src/index.css");
    const exosphereImport = source.indexOf(
      '@import "@boomi/exosphere/dist/styles.css"',
    );
    const tokenImport = source.indexOf('@import "./styles/tokens/index.css"');

    expect(exosphereImport).toBeGreaterThanOrEqual(0);
    expect(tokenImport).toBeGreaterThan(exosphereImport);
  });
});
