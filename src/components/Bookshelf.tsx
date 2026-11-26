import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BOOKS, bookIndex, type BookId } from "../../shared/books.ts";
import { recipesForBook } from "../../shared/recipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";
import { Book } from "./Book.tsx";

export function Bookshelf() {
  const { recipes } = useRecipes();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get("book") as BookId | null;
  const initial = requested ? Math.max(0, bookIndex(requested)) : 0;
  const [focused, setFocused] = useState(initial);
  const [openHint, setOpenHint] = useState<{ x: number; y: number } | null>(null);
  const shelfRef = useRef<HTMLDivElement>(null);

  const focusBook = useCallback(
    (index: number) => {
      const next = Math.min(BOOKS.length - 1, Math.max(0, index));
      setFocused(next);
      navigate({ pathname: "/", search: `?book=${BOOKS[next].id}` }, { replace: true });
    },
    [navigate],
  );

  useEffect(() => {
    if (!requested) {
      setFocused(0);
      return;
    }
    const index = bookIndex(requested);
    if (index >= 0) setFocused(index);
  }, [requested]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        focusBook(focused + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusBook(focused - 1);
      } else if (event.key === "Enter") {
        navigate(`/book/${BOOKS[focused].id}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, focusBook, navigate]);

  useEffect(() => {
    const row = shelfRef.current;
    const el = row?.querySelector<HTMLElement>("[data-focused='true']");
    if (!row || !el) return;
    const rowRect = row.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = elRect.left + elRect.width / 2 - (rowRect.left + rowRect.width / 2);
    if (Math.abs(delta) > 2) row.scrollBy({ left: delta, behavior: "smooth" });
  }, [focused]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        BOOKS.map((book) => [book.id, recipesForBook(recipes, book.id).length]),
      ) as Record<BookId, number>,
    [recipes],
  );

  const book = BOOKS[focused];

  return (
    <main className="shelf-page">
      <div className="shelf-stage">
        <div className="shelf-row" ref={shelfRef}>
          {BOOKS.map((item, index) => (
            <Book
              key={item.id}
              book={item}
              count={counts[item.id] ?? 0}
              focused={index === focused}
              onFocus={() => focusBook(index)}
              onOpen={() => navigate(`/book/${item.id}`)}
              onCursor={index === focused ? setOpenHint : undefined}
            />
          ))}
        </div>
        <div className="shelf-shadow" aria-hidden="true" />
      </div>

      <div className="shelf-controls">
        <button
          type="button"
          className="round-btn"
          aria-label="Previous book"
          disabled={focused === 0}
          onClick={() => focusBook(focused - 1)}
        >
          ‹
        </button>
        <p className="shelf-caption">
          <span>Book {book.number}</span>
          {book.title}
        </p>
        <button
          type="button"
          className="round-btn"
          aria-label="Next book"
          disabled={focused === BOOKS.length - 1}
          onClick={() => focusBook(focused + 1)}
        >
          ›
        </button>
      </div>

      {openHint ? (
        <div className="open-cursor" style={{ left: openHint.x, top: openHint.y }}>
          Open
        </div>
      ) : null}
    </main>
  );
}
