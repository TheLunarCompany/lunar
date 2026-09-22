export type ParsedSkillMarkdown = {
  name?: string;
  description?: string;
  body: string;
};

export function parseSkillMarkdown(markdown: string): ParsedSkillMarkdown {
  const normalizedMarkdown = markdown.replace(/\r\n?/g, "\n");
  const { data, content } = parseFrontmatter(normalizedMarkdown);
  const body = content.trim();

  return {
    name: getFrontmatterString(data["name"]) ?? findFirstHeading(body),
    description:
      getFrontmatterString(data["description"]) ?? findFirstParagraph(body),
    body,
  };
}

function parseFrontmatter(markdown: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(markdown);
  if (!match) return { data: {}, content: markdown };

  return {
    data: parseYamlFields(match[1] ?? ""),
    content: match[2] ?? "",
  };
}

function parseYamlFields(yaml: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const scalar = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line ?? "");
    if (!scalar) continue;

    const key = scalar[1] ?? "";
    const value = (scalar[2] ?? "").trim();

    if (value === ">-") {
      const foldedLines: string[] = [];
      while (lines[index + 1]?.startsWith(" ")) {
        index += 1;
        foldedLines.push((lines[index] ?? "").trim());
      }
      data[key] = foldedLines.join(" ");
      continue;
    }

    data[key] = unquoteYamlString(value);
  }

  return data;
}

function unquoteYamlString(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function getFrontmatterString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function findFirstHeading(body: string): string | undefined {
  return body
    .split("\n")
    .map((line) => /^#\s+(.+)$/.exec(line.trim())?.[1]?.trim())
    .find((heading): heading is string => Boolean(heading));
}

function findFirstParagraph(body: string): string | undefined {
  return body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .find(
      (block) =>
        Boolean(block) &&
        !block.startsWith("#") &&
        !block.startsWith("```") &&
        !block.startsWith("---"),
    );
}
