import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getBook } from "../../shared/books.ts";
import { photoUrl } from "../data/loadRecipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";

export function RecipeView() {
  const { slug = "" } = useParams();
  const { recipes } = useRecipes();
  const recipe = recipes.find((item) => item.slug === slug);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [hero, setHero] = useState(0);

  const book = recipe ? getBook(recipe.category) : undefined;
  const photos = recipe?.photos ?? [];
  const activePhoto = photos[hero];

  const searchBits = useMemo(() => {
    if (!recipe) return "";
    return [recipe.title, recipe.contributor, ...recipe.tags].join(" ");
  }, [recipe]);

  if (!recipe || !book) return <Navigate to="/index" replace />;

  const meta = [
    recipe.prepTime ? { label: "Prep", value: recipe.prepTime } : null,
    recipe.cookTime ? { label: "Cook", value: recipe.cookTime } : null,
    recipe.servings ? { label: "Serves", value: recipe.servings } : null,
  ].filter((item): item is { label: string; value: string } => item != null);

  return (
    <main className="recipe-page">
      <div className="recipe-toolbar print-hide">
        <Link to={`/book/${book.id}`}>← {book.title}</Link>
        <div className="toolbar-right">
          {recipe.source === "seed" ? <span className="badge">Sample</span> : <span className="badge">Family</span>}
          <button type="button" className="pill is-active" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      {photos.length > 0 ? (
        <figure className="recipe-hero print-hide">
          <img src={photoUrl(activePhoto.id)} alt={activePhoto.alt || recipe.title} />
          {photos.length > 1 ? (
            <div className="thumbs">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  className={index === hero ? "is-active" : ""}
                  onClick={() => setHero(index)}
                >
                  <img src={photoUrl(photo.id)} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </figure>
      ) : null}

      <p className="eyebrow">
        Book {book.number} : {book.title}
      </p>
      <h1>{recipe.title}</h1>
      {recipe.contributor ? (
        <p className="byline">
          Contributed by <strong>{recipe.contributor}</strong>
        </p>
      ) : null}

      {meta.length > 0 ? (
        <dl className="meta">
          {meta.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {recipe.tags.length > 0 ? (
        <p className="tag-row" data-search={searchBits}>
          {recipe.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </p>
      ) : null}

      {recipe.ingredients.length > 0 || recipe.steps.length > 0 ? (
        <div className="recipe-grid">
          {recipe.ingredients.length > 0 ? (
            <section>
              <h2>Ingredients</h2>
              <ul className="checklist">
                {recipe.ingredients.map((item, index) => (
                  <li key={item}>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(checked[index])}
                        onChange={() =>
                          setChecked((current) => ({ ...current, [index]: !current[index] }))
                        }
                      />
                      <span>{item}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {recipe.steps.length > 0 ? (
            <section>
              <h2>Steps</h2>
              <ol className="steps">
                {recipe.steps.map((step, index) => (
                  <li key={step}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      ) : null}

      {recipe.notes ? (
        <aside className="family-notes">
          <h2>Family notes</h2>
          <p>{recipe.notes}</p>
        </aside>
      ) : null}
    </main>
  );
}
