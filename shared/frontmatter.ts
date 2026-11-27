export type RecipeFrontmatter = {
  title: string;
  category: string;
  contributor: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  tags: string[];
  notes: string;
};

export type ParsedMarkdown = {
  data: RecipeFrontmatter;
  body: string;
};

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseTags(value: string): string[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }
  return trimmed ? [stripQuotes(trimmed)] : [];
}

export function parseFrontmatter(raw: string): ParsedMarkdown {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Recipe is missing YAML frontmatter");
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    fields[key] = value;
  }

  const required = [
    "title",
    "category",
    "contributor",
    "prepTime",
    "cookTime",
    "servings",
  ] as const;
  for (const key of required) {
    if (!fields[key]) {
      throw new Error(`Recipe frontmatter is missing "${key}"`);
    }
  }

  return {
    data: {
      title: stripQuotes(fields.title),
      category: stripQuotes(fields.category),
      contributor: stripQuotes(fields.contributor),
      prepTime: stripQuotes(fields.prepTime),
      cookTime: stripQuotes(fields.cookTime),
      servings: stripQuotes(fields.servings),
      tags: parseTags(fields.tags ?? ""),
      notes: stripQuotes(fields.notes ?? ""),
    },
    body: match[2].trim(),
  };
}

export function slugFromPath(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.md$/i, "");
}

export function extractSectionList(body: string, heading: string): string[] {
  const headingPattern = new RegExp(`^##\\s+${heading}\\s*$`, "i");
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => headingPattern.test(line));
  if (start === -1) return [];

  const items: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) break;
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const text = (bullet?.[1] ?? numbered?.[1])?.trim();
    if (text) items.push(text);
  }
  return items;
}
