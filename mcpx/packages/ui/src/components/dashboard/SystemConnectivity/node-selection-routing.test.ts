import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const systemConnectivityDir = resolve(
  process.cwd(),
  "src/components/dashboard/SystemConnectivity",
);

function readSystemConnectivityFile(relativePath: string): string {
  return readFileSync(resolve(systemConnectivityDir, relativePath), "utf8");
}

describe("SystemConnectivity node selection routing", () => {
  it("keeps graph node selection out of URL search params", () => {
    const files = [
      "ConnectivityDiagram.tsx",
      "nodes/McpServerNodeRenderer.tsx",
      "nodes/McpxNodeRenderer.tsx",
    ];

    for (const file of files) {
      const source = readSystemConnectivityFile(file);

      expect(source).not.toContain('searchParams.get("node")');
      expect(source).not.toContain('next.set("node"');
      expect(source).not.toContain('next.delete("node"');
    }
  });
});
