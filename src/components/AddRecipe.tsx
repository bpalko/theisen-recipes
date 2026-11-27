import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BOOKS } from "../../shared/books.ts";
import {
  ALLOWED_PHOTO_TYPES,
  PHOTO_MAX_BYTES,
  PHOTO_MAX_COUNT,
  type Recipe,
} from "../../shared/recipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";

type Preview = { file: File; url: string };

export function AddRecipe() {
  const navigate = useNavigate();
  const { refresh } = useRecipes();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<Preview[]>([]);

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = [...(event.target.files ?? [])];
    event.target.value = "";
    const next: Preview[] = [...photos];
    for (const file of incoming) {
      if (next.length >= PHOTO_MAX_COUNT) {
        setError(`You can attach up to ${PHOTO_MAX_COUNT} photos.`);
        break;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        setError(`"${file.name}" is larger than 8 MB.`);
        continue;
      }
      if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
        setError(`"${file.name}" must be a JPEG, PNG, WebP, or GIF.`);
        continue;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setPhotos(next);
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const copy = [...current];
      URL.revokeObjectURL(copy[index].url);
      copy.splice(index, 1);
      return copy;
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    for (const photo of photos) data.append("photos", photo.file);

    try {
      const response = await fetch("/api/recipes", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data,
      });
      const body = (await response.json()) as { recipe?: Recipe; error?: string };
      if (!response.ok || !body.recipe) {
        setError(
          body.error ??
            (response.status === 507
              ? "The recipe bookshelf is out of storage space."
              : "Could not save that recipe."),
        );
        setBusy(false);
        return;
      }
      await refresh();
      navigate(`/recipe/${body.recipe.slug}`);
    } catch {
      setError("Recipe storage is not available. Run the app with wrangler pages dev so R2 is bound.");
      setBusy(false);
    }
  }

  return (
    <main className="form-page">
      <p className="eyebrow">New card for the shelf</p>
      <h1>Add a family recipe</h1>
      <p className="lede">
        Photos live in the Cloudflare R2 bucket. The recipe is saved next to them so it survives deploys.
      </p>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      <form className="recipe-form" onSubmit={onSubmit}>
        <label>
          Title *
          <input name="title" required placeholder="Grandma’s rye bread" />
        </label>
        <label>
          Book / category *
          <select name="category" required defaultValue="baking">
            {BOOKS.map((book) => (
              <option key={book.id} value={book.id}>
                {book.number} {book.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contributed by *
          <input name="contributor" required placeholder="Aunt Carol" />
        </label>
        <div className="form-row">
          <label>
            Prep time *
            <input name="prepTime" required placeholder="20 min" />
          </label>
          <label>
            Cook time *
            <input name="cookTime" required placeholder="40 min" />
          </label>
          <label>
            Servings *
            <input name="servings" required placeholder="6" />
          </label>
        </div>
        <label>
          Tags
          <input name="tags" placeholder="one per line or comma-separated" />
        </label>
        <label>
          Ingredients *
          <textarea name="ingredients" required rows={8} placeholder={"1 cup milk\n2 eggs"} />
        </label>
        <label>
          Steps *
          <textarea name="steps" required rows={8} placeholder={"Warm the milk.\nStir in the eggs."} />
        </label>
        <label>
          Family notes
          <textarea name="notes" rows={3} placeholder="Make it the night before." />
        </label>

        <fieldset className="photo-field">
          <legend>Pictures</legend>
          <p>Optional. JPEG, PNG, WebP, or GIF. Up to {PHOTO_MAX_COUNT} photos, 8 MB each.</p>
          <input
            type="file"
            accept={ALLOWED_PHOTO_TYPES.join(",")}
            multiple
            onChange={onFiles}
          />
          {photos.length > 0 ? (
            <ul className="photo-previews">
              {photos.map((photo, index) => (
                <li key={photo.url}>
                  <img src={photo.url} alt="" />
                  <button type="button" onClick={() => removePhoto(index)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </fieldset>

        <button className="submit-btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save recipe"}
        </button>
      </form>
    </main>
  );
}
