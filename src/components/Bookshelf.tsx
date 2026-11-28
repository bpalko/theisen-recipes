import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BOOKS, bookIndex, normalizeBookId, type BookId } from "../../shared/books.ts";
import { recipesForBook } from "../../shared/recipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";
import { Book } from "./Book.tsx";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clampIndex(index: number): number {
  return Math.min(BOOKS.length - 1, Math.max(0, index));
}

function slotMetrics(row: HTMLElement) {
  const slots = row.querySelectorAll<HTMLElement>(".book-slot");
  const styles = getComputedStyle(row);
  const gap = parseFloat(styles.columnGap || styles.gap) || 0;
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingRight = parseFloat(styles.paddingRight) || 0;
  const cover =
    slots[0]?.querySelector<HTMLElement>(".book-3d")?.offsetWidth ??
    (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cover-w")) || 248);
  const unfocused = [...slots].find((slot) => !slot.classList.contains("is-focused"));
  const spine =
    unfocused?.offsetWidth ||
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spine")) ||
    50;
  return { slots: slots.length, gap, paddingLeft, paddingRight, cover, spine };
}

/** Resting scrollLeft when `index` is the open cover and every other book is a spine. */
function targetScrollLeft(row: HTMLElement, index: number): number {
  const { slots, gap, paddingLeft, paddingRight, cover, spine } = slotMetrics(row);
  if (!slots) return 0;
  const leftEdge = paddingLeft + index * (spine + gap);
  const totalWidth = paddingLeft + cover + (slots - 1) * (spine + gap) + paddingRight;
  const target = leftEdge + cover / 2 - row.clientWidth / 2;
  const max = Math.max(0, totalWidth - row.clientWidth);
  return Math.min(max, Math.max(0, target));
}

function centerBookIndex(row: HTMLElement, index: number, behavior: ScrollBehavior = "auto") {
  const left = targetScrollLeft(row, index);
  if (Math.abs(row.scrollLeft - left) < 0.5) return;
  row.scrollTo({ left, behavior });
}

function nearestBookIndex(row: HTMLElement): number {
  const center = row.getBoundingClientRect().left + row.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  row.querySelectorAll<HTMLElement>(".book-slot").forEach((slot, index) => {
    const rect = slot.getBoundingClientRect();
    const dist = Math.abs(rect.left + rect.width / 2 - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = index;
    }
  });
  return best;
}

export function Bookshelf() {
  const { recipes } = useRecipes();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = normalizeBookId(params.get("book"));
  const initial = requested ? Math.max(0, bookIndex(requested)) : 0;
  const [focused, setFocused] = useState(initial);
  const [visual, setVisual] = useState(initial);
  const [openHint, setOpenHint] = useState<{ x: number; y: number } | null>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(focused);
  const programmatic = useRef(false);
  const skipUrlSelect = useRef(false);
  const unlockTimer = useRef(0);

  focusedRef.current = focused;

  const scrollBehavior = useCallback(
    (): ScrollBehavior => (prefersReducedMotion() ? "auto" : "smooth"),
    [],
  );

  const applyFocus = useCallback(
    (index: number) => {
      const next = clampIndex(index);
      focusedRef.current = next;
      setFocused(next);
      setVisual(next);
      skipUrlSelect.current = true;
      navigate({ pathname: "/", search: `?book=${BOOKS[next].id}` }, { replace: true });
    },
    [navigate],
  );

  const selectBook = useCallback(
    (index: number) => {
      const next = clampIndex(index);
      const row = shelfRef.current;
      applyFocus(next);
      if (!row) return;
      programmatic.current = true;
      window.clearTimeout(unlockTimer.current);
      const go = () => centerBookIndex(row, next, scrollBehavior());
      window.requestAnimationFrame(() => window.requestAnimationFrame(go));
      unlockTimer.current = window.setTimeout(() => {
        programmatic.current = false;
      }, prefersReducedMotion() ? 200 : 800);
    },
    [applyFocus, scrollBehavior],
  );

  const stepBook = useCallback(
    (delta: number) => {
      const row = shelfRef.current;
      const from = row ? nearestBookIndex(row) : focusedRef.current;
      selectBook(from + delta);
    },
    [selectBook],
  );

  useEffect(() => {
    if (skipUrlSelect.current) {
      skipUrlSelect.current = false;
      return;
    }
    if (!requested) {
      if (focusedRef.current !== 0) selectBook(0);
      return;
    }
    const index = bookIndex(requested);
    if (index < 0 || index === focusedRef.current) return;
    selectBook(index);
  }, [requested, selectBook]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stepBook(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepBook(-1);
      } else if (event.key === "Enter") {
        navigate(`/book/${BOOKS[focusedRef.current].id}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepBook, navigate]);

  useLayoutEffect(() => {
    const row = shelfRef.current;
    if (!row) return;
    centerBookIndex(row, focused, "auto");
  }, []);

  useEffect(() => {
    const row = shelfRef.current;
    if (!row) return;
    let scrollTimer = 0;
    let frame = 0;

    const onScrollSettled = () => {
      if (programmatic.current) {
        programmatic.current = false;
        centerBookIndex(row, focusedRef.current, "auto");
        return;
      }
      const nearest = nearestBookIndex(row);
      setVisual(nearest);
      if (nearest !== focusedRef.current) applyFocus(nearest);
      window.requestAnimationFrame(() => centerBookIndex(row, nearest, scrollBehavior()));
    };

    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setVisual(nearestBookIndex(row));
      });
      if (programmatic.current) return;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(onScrollSettled, 140);
    };

    const onScrollEnd = () => {
      window.clearTimeout(scrollTimer);
      onScrollSettled();
    };

    const onResize = () => {
      centerBookIndex(row, focusedRef.current, "auto");
    };

    row.addEventListener("scroll", onScroll, { passive: true });
    row.addEventListener("scrollend", onScrollEnd);
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(unlockTimer.current);
      window.cancelAnimationFrame(frame);
      row.removeEventListener("scroll", onScroll);
      row.removeEventListener("scrollend", onScrollEnd);
      window.removeEventListener("resize", onResize);
    };
  }, [applyFocus, scrollBehavior]);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        BOOKS.map((book) => [book.id, recipesForBook(recipes, book.id).length]),
      ) as Record<BookId, number>,
    [recipes],
  );

  const book = BOOKS[visual];
  const atStart = visual === 0;
  const atEnd = visual === BOOKS.length - 1;

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
              onFocus={() => selectBook(index)}
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
          onClick={() => stepBook(-1)}
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
          onClick={() => stepBook(1)}
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
