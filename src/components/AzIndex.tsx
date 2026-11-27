import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getBook } from "../../shared/books.ts";
import { groupRecipesByLetter, searchRecipes } from "../../shared/recipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";
import { useSearchQuery } from "./SearchDock.tsx";

export function AzIndex() {
  const { recipes } = useRecipes();
  const { query, closeSearch } = useSearchQuery();
  const filtered = useMemo(() => searchRecipes(recipes, query), [recipes, query]);
  const groups = useMemo(() => groupRecipesByLetter(filtered), [filtered]);

  return (
    <div className="index-page is-sheet">
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
                    <Link
                      className="index-row"
                      to={`/recipe/${recipe.slug}`}
                      onClick={() => closeSearch()}
                    >
                      <span className="index-row-title">{recipe.title}</span>
                      <span className="index-row-meta">
                        {[book?.title, recipe.contributor].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
