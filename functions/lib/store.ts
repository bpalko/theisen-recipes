import type { Recipe, RecipePhoto } from "../../shared/recipes.ts";
import { isBookId } from "../../shared/recipes.ts";

const RECIPE_PREFIX = "recipes/";
const PHOTO_PREFIX = "photos/";

export function recipeKey(slug: string): string {
  return `${RECIPE_PREFIX}${slug}.json`;
}

export function photoKey(id: string, ext: string): string {
  return `${PHOTO_PREFIX}${id}.${ext}`;
}

function asRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<Recipe>;
  if (typeof record.slug !== "string" || typeof record.title !== "string") return null;
  if (!record.category || !isBookId(record.category)) return null;
  if (!Array.isArray(record.ingredients) || !Array.isArray(record.steps)) return null;
  const photos = Array.isArray(record.photos) ? record.photos.filter(isPhoto) : [];
  return {
    slug: record.slug,
    title: record.title,
    category: record.category,
    contributor: typeof record.contributor === "string" ? record.contributor : "",
    prepTime: typeof record.prepTime === "string" ? record.prepTime : "",
    cookTime: typeof record.cookTime === "string" ? record.cookTime : "",
    servings: typeof record.servings === "string" ? record.servings : "",
    tags: Array.isArray(record.tags) ? record.tags.filter((tag) => typeof tag === "string") : [],
    notes: typeof record.notes === "string" ? record.notes : "",
    ingredients: record.ingredients.filter((item) => typeof item === "string"),
    steps: record.steps.filter((item) => typeof item === "string"),
    photos,
    source: "family",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

function isPhoto(value: unknown): value is RecipePhoto {
  if (!value || typeof value !== "object") return false;
  const photo = value as Partial<RecipePhoto>;
  return (
    typeof photo.id === "string" &&
    typeof photo.contentType === "string" &&
    typeof photo.alt === "string"
  );
}

export async function listStoredRecipes(bucket: R2Bucket): Promise<Recipe[]> {
  const recipes: Recipe[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix: RECIPE_PREFIX, cursor, limit: 100 });
    for (const object of page.objects) {
      const stored = await bucket.get(object.key);
      if (!stored) continue;
      const parsed = asRecipe(await stored.json());
      if (parsed) recipes.push(parsed);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return recipes;
}

export async function getStoredRecipe(
  bucket: R2Bucket,
  slug: string,
): Promise<Recipe | null> {
  const stored = await bucket.get(recipeKey(slug));
  if (!stored) return null;
  return asRecipe(await stored.json());
}

export async function putStoredRecipe(bucket: R2Bucket, recipe: Recipe): Promise<void> {
  await bucket.put(recipeKey(recipe.slug), JSON.stringify(recipe, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

export async function putPhoto(
  bucket: R2Bucket,
  id: string,
  bytes: ArrayBuffer,
  contentType: string,
  ext: string,
): Promise<void> {
  await bucket.put(photoKey(id, ext), bytes, {
    httpMetadata: {
      contentType,
      cacheControl: "private, max-age=86400",
    },
  });
}

export async function getPhoto(
  bucket: R2Bucket,
  id: string,
): Promise<R2ObjectBody | null> {
  const safeId = id.replaceAll(/[^a-zA-Z0-9-]/g, "");
  if (!safeId) return null;
  for (const ext of ["jpg", "png", "webp", "gif"]) {
    const object = await bucket.get(photoKey(safeId, ext));
    if (object) return object;
  }
  return null;
}

export function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extra,
    },
  });
}

export function requireBucket(env: Env): R2Bucket | Response {
  if (!env.RECIPES) {
    return json(
      {
        error:
          "Recipe storage is not bound. Create the `theisen-recipes` R2 bucket and bind it as RECIPES.",
      },
      503,
    );
  }
  return env.RECIPES;
}
