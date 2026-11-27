import { BOOKS, type BookId } from "./books.ts";
import {
  extractSectionList,
  parseFrontmatter,
  slugFromPath,
} from "./frontmatter.ts";

export type RecipePhoto = {
  id: string;
  contentType: string;
  alt: string;
};

export type Recipe = {
  slug: string;
  title: string;
  category: BookId;
  contributor: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  tags: string[];
  notes: string;
  ingredients: string[];
  steps: string[];
  photos: RecipePhoto[];
  source: "seed" | "family";
  createdAt?: string;
  updatedAt?: string;
};

export type RecipeDraft = {
  title: string;
  category: BookId;
  contributor: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  tags: string[];
  notes: string;
  ingredients: string[];
  steps: string[];
};

const BOOK_IDS = new Set(BOOKS.map((book) => book.id));

export function isBookId(value: string): value is BookId {
  return BOOK_IDS.has(value as BookId);
}

export function recipeFromMarkdown(filePath: string, raw: string): Recipe {
  const { data, body } = parseFrontmatter(raw);
  if (!isBookId(data.category)) {
    throw new Error(`${filePath}: unknown category "${data.category}"`);
  }
  const ingredients = extractSectionList(body, "Ingredients");
  const steps = extractSectionList(body, "Steps");
  if (ingredients.length === 0) {
    throw new Error(`${filePath}: missing Ingredients list`);
  }
  if (steps.length === 0) {
    throw new Error(`${filePath}: missing Steps list`);
  }
  return {
    slug: slugFromPath(filePath),
    title: data.title,
    category: data.category,
    contributor: data.contributor,
    prepTime: data.prepTime,
    cookTime: data.cookTime,
    servings: data.servings,
    tags: data.tags,
    notes: data.notes,
    ingredients,
    steps,
    photos: [],
    source: "seed",
  };
}

export function loadRecipesFromFiles(
  files: { path: string; raw: string }[],
): Recipe[] {
  return sortRecipesByTitle(
    files.map((file) => recipeFromMarkdown(file.path, file.raw)),
  );
}

export function sortRecipesByTitle(recipes: Recipe[]): Recipe[] {
  return [...recipes].sort((a, b) =>
    a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
  );
}

export function recipesForBook(recipes: Recipe[], bookId: BookId): Recipe[] {
  return sortRecipesByTitle(recipes.filter((recipe) => recipe.category === bookId));
}

export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);
  if (terms.length === 0) return sortRecipesByTitle(recipes);

  return sortRecipesByTitle(
    recipes.filter((recipe) => {
      const haystack = [
        recipe.title,
        recipe.category,
        recipe.contributor,
        recipe.notes,
        ...recipe.tags,
        ...recipe.ingredients,
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => haystack.includes(term));
    }),
  );
}

export function letterForTitle(title: string): string {
  const letter = title.replaceAll(/[^A-Za-z]/g, "").charAt(0).toUpperCase();
  return letter || "#";
}

export function groupRecipesByLetter(
  recipes: Recipe[],
): { letter: string; recipes: Recipe[] }[] {
  const groups = new Map<string, Recipe[]>();
  for (const recipe of sortRecipesByTitle(recipes)) {
    const letter = letterForTitle(recipe.title);
    const list = groups.get(letter) ?? [];
    list.push(recipe);
    groups.set(letter, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, list]) => ({ letter, recipes: list }));
}

export function mergeRecipes(seed: Recipe[], stored: Recipe[]): Recipe[] {
  const bySlug = new Map<string, Recipe>();
  for (const recipe of seed) bySlug.set(recipe.slug, recipe);
  for (const recipe of stored) bySlug.set(recipe.slug, recipe);
  return sortRecipesByTitle([...bySlug.values()]);
}

export function validateDraft(input: Partial<RecipeDraft>): {
  ok: true;
  draft: RecipeDraft;
} | { ok: false; error: string } {
  const title = input.title?.trim() ?? "";
  const contributor = input.contributor?.trim() ?? "";
  const prepTime = input.prepTime?.trim() ?? "";
  const cookTime = input.cookTime?.trim() ?? "";
  const servings = input.servings?.trim() ?? "";
  const notes = input.notes?.trim() ?? "";
  const category = input.category;
  const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const ingredients = (input.ingredients ?? []).map((item) => item.trim()).filter(Boolean);
  const steps = (input.steps ?? []).map((item) => item.trim()).filter(Boolean);

  if (title.length < 2) return { ok: false, error: "Add a recipe title." };
  if (!category || !isBookId(category)) {
    return { ok: false, error: "Pick a book / category." };
  }
  if (!contributor) return { ok: false, error: "Who is this recipe from?" };
  if (!prepTime || !cookTime || !servings) {
    return { ok: false, error: "Fill in prep time, cook time, and servings." };
  }
  if (ingredients.length === 0) return { ok: false, error: "Add at least one ingredient." };
  if (steps.length === 0) return { ok: false, error: "Add at least one step." };

  return {
    ok: true,
    draft: {
      title,
      category,
      contributor,
      prepTime,
      cookTime,
      servings,
      tags,
      notes,
      ingredients,
      steps,
    },
  };
}

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_MAX_COUNT = 6;
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export function photoExtension(contentType: string): string | null {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return null;
  }
}

export function isAllowedPhotoType(value: string): boolean {
  return (ALLOWED_PHOTO_TYPES as readonly string[]).includes(value);
}
