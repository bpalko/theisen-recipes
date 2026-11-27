import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { getBook } from "../../shared/books.ts";
import { recipesForBook } from "../../shared/recipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";
import { CoverArt } from "./CoverArt.tsx";

export function BookToc() {
  const { bookId = "" } = useParams();
  const navigate = useNavigate();
  const { recipes } = useRecipes();
  const book = getBook(bookId);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") navigate("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (!book) return <Navigate to="/" replace />;
  const contents = recipesForBook(recipes, book.id);

  return (
    <main className="split-page">
      <section className="toc-panel">
        <p className="eyebrow">
          Book {book.number} : {book.title}
        </p>
        <h1>{book.title}</h1>
        <p className="lede">{book.description}</p>
        <ol className="toc-grid">
          {contents.map((recipe, index) => (
            <li key={recipe.slug}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Link to={`/recipe/${recipe.slug}`}>{recipe.title}</Link>
            </li>
          ))}
        </ol>
        {contents.length === 0 ? (
          <p className="empty">
            No recipes in this book yet.{" "}
            <Link to="/add">Add one</Link>.
          </p>
        ) : null}
        <Link className="back-link" to={`/?book=${book.id}`}>
          ← Back to shelf
        </Link>
      </section>
      <aside className="toc-cover">
        <div className="toc-cover-frame">
          <CoverArt book={book} count={contents.length} />
        </div>
      </aside>
    </main>
  );
}
