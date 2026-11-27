import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  isAllowedPhotoType,
  photoExtension,
  validateDraft,
  type Recipe,
  type RecipePhoto,
} from "../../shared/recipes.ts";
import { slugify, uniqueSlug } from "../../shared/slug.ts";
import {
  encodedJsonSize,
  json,
  listStoredRecipes,
  maxBucketBytes,
  putPhoto,
  putStoredRecipe,
  rejectIfOverStorageCap,
  requireBucket,
} from "../lib/store.ts";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const bucket = requireBucket(env);
  if (bucket instanceof Response) return bucket;
  const recipes = await listStoredRecipes(bucket);
  return json({ recipes });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const bucket = requireBucket(env);
  if (bucket instanceof Response) return bucket;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return json({ error: "Send the recipe as multipart form data." }, 400);
  }

  const form = await request.formData();
  const parsed = validateDraft(readDraft(form));
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  const files = form
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length > PHOTO_MAX_COUNT) {
    return json({ error: `You can attach up to ${PHOTO_MAX_COUNT} photos.` }, 400);
  }

  const pendingPhotos: Array<{
    id: string;
    bytes: ArrayBuffer;
    contentType: string;
    ext: string;
  }> = [];

  for (const file of files) {
    if (file.size > PHOTO_MAX_BYTES) {
      return json({ error: `"${file.name}" is larger than 8 MB.` }, 400);
    }
    const type = file.type || "application/octet-stream";
    if (!isAllowedPhotoType(type)) {
      return json({ error: `"${file.name}" must be a JPEG, PNG, WebP, or GIF.` }, 400);
    }
    const ext = photoExtension(type);
    if (!ext) return json({ error: "Unsupported photo type." }, 400);
    pendingPhotos.push({
      id: crypto.randomUUID(),
      bytes: await file.arrayBuffer(),
      contentType: type,
      ext,
    });
  }

  const existing = await listStoredRecipes(bucket);
  const slugs = new Set(existing.map((recipe) => recipe.slug));
  const slug = uniqueSlug(slugify(parsed.draft.title), slugs);
  const now = new Date().toISOString();
  const photos: RecipePhoto[] = pendingPhotos.map((photo) => ({
    id: photo.id,
    contentType: photo.contentType,
    alt: `${parsed.draft.title} photo`,
  }));

  const recipe: Recipe = {
    ...parsed.draft,
    slug,
    photos,
    source: "family",
    createdAt: now,
    updatedAt: now,
  };

  const incomingBytes =
    pendingPhotos.reduce((total, photo) => total + photo.bytes.byteLength, 0) +
    encodedJsonSize(recipe);
  const blocked = await rejectIfOverStorageCap(
    bucket,
    incomingBytes,
    maxBucketBytes(env),
  );
  if (blocked) return blocked;

  for (const photo of pendingPhotos) {
    await putPhoto(bucket, photo.id, photo.bytes, photo.contentType, photo.ext);
  }
  await putStoredRecipe(bucket, recipe);
  return json({ recipe }, 201);
};

function readDraft(form: FormData) {
  const tags = String(form.get("tags") ?? "")
    .split(/[\n,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const ingredients = splitLines(String(form.get("ingredients") ?? ""));
  const steps = splitLines(String(form.get("steps") ?? ""));
  return {
    title: String(form.get("title") ?? ""),
    category: String(form.get("category") ?? "") as Recipe["category"],
    contributor: String(form.get("contributor") ?? ""),
    prepTime: String(form.get("prepTime") ?? ""),
    cookTime: String(form.get("cookTime") ?? ""),
    servings: String(form.get("servings") ?? ""),
    notes: String(form.get("notes") ?? ""),
    tags,
    ingredients,
    steps,
  };
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").replace(/^\s*[-*+]\s*/, "").trim())
    .filter(Boolean);
}
