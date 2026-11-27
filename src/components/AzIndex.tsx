import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getBook } from "../../shared/books.ts";
import { groupRecipesByLetter, searchRecipes } from "../../shared/recipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";
import { useSearchQuery } from "./SearchDock.tsx";

export function AzIndex() {
  const { recipes } = useRecipes();
  const { query } = useSearchQuery();
  const filtered = useMemo(() => searchRecipes(recipes, query), [recipes, query]);
  const groups = useMemo(() => groupRecipesByLetter(filtered), [filtered]);

  return (
    <main className="index-page">
      <div className="index-head">
        <div>
          <p className="eyebrow">Directory</p>
          <h1>{query.trim() ? "Matching recipes" : "All recipes"}</h1>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="empty">No recipes match that search.</p>
      ) : (
        groups.map((group) => (
          <section key={group.letter} className="letter-block">
            <h2>{group.letter}</h2>
            <ul>
              {group.recipes.map((recipe) => {
                const book = getBook(recipe.category);
                return (
                  <li key={recipe.slug}>
                    <Link to={`/recipe/${recipe.slug}`}>{recipe.title}</Link>
                    <span>
                      {[book?.title, recipe.contributor].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
