import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOOKS } from "../shared/books.ts";
import {
  groupRecipesByLetter,
  loadRecipesFromFiles,
  mergeRecipes,
  recipesForBook,
  searchRecipes,
  sortRecipesByTitle,
  validateDraft,
} from "../shared/recipes.ts";
import { slugify, uniqueSlug } from "../shared/slug.ts";

const recipesDir = join(dirname(fileURLToPath(import.meta.url)), "../src/content/recipes");

function loadSeed() {
  const files = readdirSync(recipesDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => ({
      path: join(recipesDir, name),
      raw: readFileSync(join(recipesDir, name), "utf8"),
    }));
  return loadRecipesFromFiles(files);
}

describe("recipe indexing", () => {
  const recipes = loadSeed();

  it("loads every seeded markdown file with required fields", () => {
    expect(recipes.length).toBeGreaterThanOrEqual(12);
    for (const recipe of recipes) {
      expect(recipe.title.length).toBeGreaterThan(2);
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.steps.length).toBeGreaterThan(0);
      expect(recipe.source).toBe("seed");
    }
  });

  it("places at least one recipe in each book", () => {
    for (const book of BOOKS) {
      expect(recipesForBook(recipes, book.id).length).toBeGreaterThan(0);
    }
  });

  it("sorts alphabetically by title", () => {
    const titles = sortRecipesByTitle(recipes).map((recipe) => recipe.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));
  });

  it("searches title, contributor, tags, and ingredients", () => {
    expect(searchRecipes(recipes, "cinnamon").map((recipe) => recipe.slug)).toContain(
      "grandma-theisen-cinnamon-rolls",
    );
    expect(searchRecipes(recipes, "Uncle Jim").length).toBeGreaterThan(0);
    expect(searchRecipes(recipes, "paprika").length).toBeGreaterThan(0);
    expect(searchRecipes(recipes, "zzzz-nope")).toEqual([]);
  });

  it("groups A–Z by first letter", () => {
    const letters = groupRecipesByLetter(recipes).map((group) => group.letter);
    expect(letters).toEqual([...letters].sort());
    const apple = groupRecipesByLetter(recipes).find((group) => group.letter === "A");
    expect(apple?.recipes.some((recipe) => recipe.title.startsWith("Apple"))).toBe(true);
  });

  it("lets family recipes override seed recipes with the same slug", () => {
    const seed = recipes[0];
    const merged = mergeRecipes(recipes, [
      { ...seed, title: "Updated family version", source: "family", photos: [] },
    ]);
    const match = merged.find((recipe) => recipe.slug === seed.slug);
    expect(match?.title).toBe("Updated family version");
    expect(match?.source).toBe("family");
  });
});

describe("add-recipe validation", () => {
  it("rejects an empty draft", () => {
    const result = validateDraft({});
    expect(result.ok).toBe(false);
  });

  it("accepts a complete draft", () => {
    const result = validateDraft({
      title: "Rye Bread",
      category: "baking",
      contributor: "Brendan",
      prepTime: "20 min",
      cookTime: "40 min",
      servings: "1 loaf",
      tags: ["bread"],
      notes: "",
      ingredients: ["3 cups rye flour"],
      steps: ["Mix and bake."],
    });
    expect(result.ok).toBe(true);
  });

  it("slugifies titles and avoids collisions", () => {
    expect(slugify("Grandma Theisen's Cinnamon Rolls")).toBe(
      "grandma-theisens-cinnamon-rolls",
    );
    expect(slugify("Apple Crisp")).toBe("apple-crisp");
    expect(uniqueSlug("stew", new Set(["stew"]))).toBe("stew-2");
  });
});
