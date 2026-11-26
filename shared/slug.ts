const STOP_WORDS = new Set(["a", "an", "the", "and", "of", "for", "to"]);

export function slugify(title: string): string {
  const words = title
    .normalize("NFKD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/['’]/g, "")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const kept = words.filter((word, index) => index === 0 || !STOP_WORDS.has(word));
  const slug = (kept.length ? kept : words).join("-").slice(0, 80);
  return slug.replace(/-+$/g, "") || "recipe";
}

export function uniqueSlug(desired: string, existing: Set<string>): string {
  if (!existing.has(desired)) return desired;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${desired}-${n}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${desired}-${Date.now()}`;
}
