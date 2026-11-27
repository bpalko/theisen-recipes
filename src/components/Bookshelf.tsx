import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BOOKS, bookIndex, normalizeBookId, type BookId } from "../../shared/books.ts";
import { recipesForBook } from "../../shared/recipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";
import { Book } from "./Book.tsx";

function centerSlot(row: HTMLElement, slot: HTMLElement) {
  const rowRect = row.getBoundingClientRect();
  const slotRect = slot.getBoundingClientRect();
  const delta = slotRect.left + slotRect.width / 2 - (rowRect.left + row.clientWidth / 2);
  if (Math.abs(delta) < 0.5) return;
  row.scrollLeft += delta;
}

export function Bookshelf() {
  const { recipes } = useRecipes();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = normalizeBookId(params.get("book"));
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

  const centerFocused = useCallback(() => {
    const row = shelfRef.current;
    const slot = row?.querySelector<HTMLElement>("[data-focused='true']");
    if (!row || !slot) return;
    centerSlot(row, slot);
  }, []);

  useLayoutEffect(() => {
    centerFocused();
  }, [focused, centerFocused]);

  useEffect(() => {
    const row = shelfRef.current;
    if (!row) return;
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.propertyName === "flex-basis" || event.propertyName === "transform") {
        centerFocused();
      }
    };
    row.addEventListener("transitionend", onTransitionEnd);
    row.addEventListener("scrollend", centerFocused);
    window.addEventListener("resize", centerFocused);

    const observer = new ResizeObserver(centerFocused);
    observer.observe(row);
    for (const child of row.children) observer.observe(child);

    return () => {
      row.removeEventListener("transitionend", onTransitionEnd);
      row.removeEventListener("scrollend", centerFocused);
      window.removeEventListener("resize", centerFocused);
      observer.disconnect();
    };
  }, [focused, centerFocused]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        BOOKS.map((book) => [book.id, recipesForBook(recipes, book.id).length]),
      ) as Record<BookId, number>,
    [recipes],
  );

  const book = BOOKS[focused];
  const atStart = focused === 0;
  const atEnd = focused === BOOKS.length - 1;

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
          disabled={atStart}
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
          disabled={atEnd}
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
