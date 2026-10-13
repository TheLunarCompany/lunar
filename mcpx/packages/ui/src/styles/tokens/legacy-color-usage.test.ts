import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const sourceRoot = resolve(process.cwd(), "src");
const sourceExtensions = new Set([".css", ".ts", ".tsx"]);
const excludedFilePattern = /\.(stories|test)\.[^.]+$/;
const excludedDirectoryNames = new Set(["stories"]);

const legacyVariablePattern =
  /--(?:colors-|structure-color-|text-colours-color-|component-colours-color-|data-series-|layout-|shadow-node-indicator\b|skill-avatar-|color-(?:bg|fg|text|data)-|color-border-(?:primary|interactive|info|success|warning|danger|attention)|color-active-|color-mcpx-server\b|color-no-agents\b|lunar-purple)/g;
const paletteUtilityPattern =
  /\b(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b/g;
const hardcodedColorPattern = /#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(/g;

const allowedHardcodedColors = new Map([
  ["components/ui/chart.tsx", new Set(["#ccc", "#fff"])],
  ["styles/tokens/exosphere.css", new Set(["#5147e4", "rgb(", "#808cff"])],
]);

const listProductionSources = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && excludedDirectoryNames.has(entry.name)) {
      return [];
    }

    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listProductionSources(path);
    }

    if (
      !sourceExtensions.has(extname(entry.name)) ||
      excludedFilePattern.test(entry.name)
    ) {
      return [];
    }

    return [path];
  });

const findMatches = (pattern: RegExp): string[] =>
  listProductionSources(sourceRoot).flatMap((path) => {
    const relativePath = relative(sourceRoot, path).split(sep).join("/");

    return readFileSync(path, "utf8")
      .split("\n")
      .flatMap((line, index) =>
        Array.from(line.matchAll(pattern), (match) => ({
          line: index + 1,
          value: match[0],
        }))
          .filter(
            ({ value }) =>
              !allowedHardcodedColors.get(relativePath)?.has(value),
          )
          .map(
            ({ line: lineNumber, value }) =>
              `${relativePath}:${lineNumber}: ${value}`,
          ),
      );
  });

describe("legacy color usage", () => {
  it("keeps production color styling on MCPX semantic tokens", () => {
    const unapprovedLegacyUsages = findMatches(legacyVariablePattern);
    const unapprovedPaletteUtilities = findMatches(paletteUtilityPattern);
    const unapprovedHardcodedColors = findMatches(hardcodedColorPattern);

    expect(unapprovedLegacyUsages).toEqual([]);
    expect(unapprovedPaletteUtilities).toEqual([]);
    expect(unapprovedHardcodedColors).toEqual([]);
  });
});
