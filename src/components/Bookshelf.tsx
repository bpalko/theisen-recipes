import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BOOKS, bookIndex, normalizeBookId, type BookId } from "../../shared/books.ts";
import { recipesForBook } from "../../shared/recipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";
import { Book } from "./Book.tsx";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Final resting scrollLeft with `index` open and every other book a spine. */
function targetScrollLeft(row: HTMLElement, index: number): number {
  const slots = row.querySelectorAll<HTMLElement>(".book-slot");
  if (!slots.length) return 0;
  const gap = parseFloat(getComputedStyle(row).gap) || 0;
  const paddingLeft = parseFloat(getComputedStyle(row).paddingLeft) || 0;
  const paddingRight = parseFloat(getComputedStyle(row).paddingRight) || 0;
  const spine =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spine")) || 50;
  const cover = slots[0].querySelector<HTMLElement>(".book-3d")?.offsetWidth ?? slots[0].offsetWidth;

  let leftEdge = paddingLeft;
  for (let i = 0; i < index; i++) leftEdge += spine + gap;
  const totalWidth =
    paddingLeft + cover + (slots.length - 1) * spine + (slots.length - 1) * gap + paddingRight;
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
  const slots = row.querySelectorAll<HTMLElement>(".book-slot");
  slots.forEach((slot, index) => {
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
  const [openHint, setOpenHint] = useState<{ x: number; y: number } | null>(null);
  const shelfRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(focused);
  /** Instant recenter before paint — initial load and viewport resize only. */
  const shouldRecenterInstant = useRef(true);
  /** After focus lands (swipe settle or scroll-then-open), nudge to final center. */
  const shouldSettle = useRef(false);
  /** Skip scroll→index sync while a programmatic scroll is in flight. */
  const ignoreScrollSync = useRef(false);
  /** When set, scrollend should open this index instead of deriving from position. */
  const pendingOpenIndex = useRef<number | null>(null);
  const snapRestoreTimer = useRef(0);
  const unlockTimer = useRef(0);

  focusedRef.current = focused;

  const withSnapDisabled = useCallback((run: () => void) => {
    const row = shelfRef.current;
    if (!row) {
      run();
      return;
    }
    window.clearTimeout(snapRestoreTimer.current);
    row.style.scrollSnapType = "none";
    run();
    snapRestoreTimer.current = window.setTimeout(() => {
      row.style.scrollSnapType = "";
    }, prefersReducedMotion() ? 50 : 800);
  }, []);

  const lockScrollSync = useCallback((ms: number) => {
    ignoreScrollSync.current = true;
    window.clearTimeout(unlockTimer.current);
    unlockTimer.current = window.setTimeout(() => {
      ignoreScrollSync.current = false;
    }, ms);
  }, []);

  const applyFocus = useCallback(
    (index: number) => {
      const next = Math.min(BOOKS.length - 1, Math.max(0, index));
      focusedRef.current = next;
      setFocused(next);
      navigate({ pathname: "/", search: `?book=${BOOKS[next].id}` }, { replace: true });
    },
    [navigate],
  );

  /** Arrow / keyboard / direct tap: scroll to the target spine, then open on scrollend. */
  const selectBook = useCallback(
    (index: number) => {
      const next = Math.min(BOOKS.length - 1, Math.max(0, index));
      const row = shelfRef.current;
      if (!row) {
        applyFocus(next);
        return;
      }
      if (next === focusedRef.current) return;

      if (prefersReducedMotion()) {
        applyFocus(next);
        shouldRecenterInstant.current = true;
        lockScrollSync(200);
        return;
      }

      // Slide toward the final centered position while layout is still stable,
      // then open when the scroll finishes (settle is usually a small nudge).
      pendingOpenIndex.current = next;
      lockScrollSync(900);
      withSnapDisabled(() => centerBookIndex(row, next, "smooth"));
    },
    [applyFocus, lockScrollSync, withSnapDisabled],
  );

  useEffect(() => {
    if (!requested) {
      if (focusedRef.current === 0) return;
      selectBook(0);
      return;
    }
    const index = bookIndex(requested);
    if (index < 0 || index === focusedRef.current) return;
    // URL / pill navigation — same scroll-then-open path.
    selectBook(index);
  }, [requested, selectBook]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        selectBook(focused + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        selectBook(focused - 1);
      } else if (event.key === "Enter") {
        navigate(`/book/${BOOKS[focused].id}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, selectBook, navigate]);

  // Instant recenter before paint — load + resize only.
  useLayoutEffect(() => {
    if (!shouldRecenterInstant.current) return;
    shouldRecenterInstant.current = false;
    const row = shelfRef.current;
    if (!row) return;
    withSnapDisabled(() => centerBookIndex(row, focusedRef.current, "auto"));
  }, [focused, withSnapDisabled]);

  // After opening a book (swipe or scroll-then-open), settle to final center.
  useEffect(() => {
    if (!shouldSettle.current) return;
    shouldSettle.current = false;
    const row = shelfRef.current;
    if (!row) return;
    const frame = window.requestAnimationFrame(() => {
      withSnapDisabled(() =>
        centerBookIndex(row, focusedRef.current, prefersReducedMotion() ? "auto" : "smooth"),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focused, withSnapDisabled]);

  useEffect(() => {
    const row = shelfRef.current;
    if (!row) return;

    const onScrollSettled = () => {
      const pending = pendingOpenIndex.current;
      if (pending !== null) {
        pendingOpenIndex.current = null;
        applyFocus(pending);
        shouldSettle.current = true;
        lockScrollSync(prefersReducedMotion() ? 200 : 750);
        return;
      }

      if (ignoreScrollSync.current) return;

      const nearest = nearestBookIndex(row);
      if (nearest === focusedRef.current) return;
      // Swipe: adopt nearest book, then settle (never snap back to the previous book).
      applyFocus(nearest);
      shouldSettle.current = true;
      lockScrollSync(prefersReducedMotion() ? 200 : 750);
    };

    let scrollTimer = 0;
    const supportsScrollEnd = "onscrollend" in window;
    const onScrollEnd = () => {
      window.clearTimeout(scrollTimer);
      onScrollSettled();
    };
    const onScroll = () => {
      if (supportsScrollEnd) return;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(onScrollSettled, 140);
    };

    const onResize = () => {
      shouldRecenterInstant.current = true;
      lockScrollSync(200);
      withSnapDisabled(() => centerBookIndex(row, focusedRef.current, "auto"));
    };

    if (supportsScrollEnd) row.addEventListener("scrollend", onScrollEnd);
    else row.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(snapRestoreTimer.current);
      window.clearTimeout(unlockTimer.current);
      row.removeEventListener("scrollend", onScrollEnd);
      row.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [applyFocus, lockScrollSync, withSnapDisabled]);

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
          onClick={() => selectBook(focused - 1)}
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
          onClick={() => selectBook(focused + 1)}
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
