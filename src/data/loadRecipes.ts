import { loadRecipesFromFiles, type Recipe } from "../../shared/recipes.ts";

const modules = import.meta.glob("../content/recipes/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

export const seedRecipes: Recipe[] = loadRecipesFromFiles(
  Object.entries(modules).map(([path, raw]) => ({ path, raw })),
);

export async function fetchFamilyRecipes(): Promise<Recipe[]> {
  try {
    const response = await fetch("/api/recipes", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { recipes?: Recipe[] };
    return Array.isArray(body.recipes) ? body.recipes : [];
  } catch {
    return [];
  }
}

export function photoUrl(id: string): string {
  return `/api/photos/${id}`;
}
