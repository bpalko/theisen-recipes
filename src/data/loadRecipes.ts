import type { Recipe } from "../../shared/recipes.ts";

/** Family recipes live in R2. Nothing is bundled from the repo. */
export const seedRecipes: Recipe[] = [];

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
