import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BOOKS, bookIndex, normalizeBookId, type BookId } from "../../shared/books.ts";
import { recipesForBook } from "../../shared/recipes.ts";
import { useRecipes } from "../data/RecipeContext.tsx";
import { Book } from "./Book.tsx";

type Metrics = {
  padL: number;
  padR: number;
  spine: number;
  cover: number;
  gap: number;
  count: number;
  clientWidth: number;
};

const SHELF_MS = 700;
const SETTLE_MS = 320;
const EASE = bezierEasing(0.22, 1, 0.36, 1);

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clampIndex(index: number): number {
  return Math.min(BOOKS.length - 1, Math.max(0, index));
}

function bezierEasing(x1: number, y1: number, x2: number, y2: number) {
  const ax = 3 * x1 - 3 * x2 + 1;
  const bx = 3 * x2 - 6 * x1;
  const cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1;
  const by = 3 * y2 - 6 * y1;
  const cy = 3 * y1;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleXd = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = sampleXd(t);
      if (Math.abs(d) < 1e-6) break;
      t = Math.min(1, Math.max(0, t - (sampleX(t) - x) / d));
    }
    return sampleY(t);
  };
}

function maxScroll(metrics: Metrics): number {
  const total =
    metrics.padL +
    metrics.cover +
    (metrics.count - 1) * (metrics.spine + metrics.gap) +
    metrics.padR;
  return Math.max(0, total - metrics.clientWidth);
}

function clampScroll(left: number, metrics: Metrics): number {
  return Math.min(maxScroll(metrics), Math.max(0, left));
}

function readMetrics(row: HTMLElement): Metrics {
  const styles = getComputedStyle(row);
  const root = getComputedStyle(document.documentElement);
  const coverEl = row.querySelector<HTMLElement>(".book-3d");
  const metrics = {
    padL: parseFloat(styles.paddingLeft) || 0,
    padR: parseFloat(styles.paddingRight) || 0,
    gap: parseFloat(styles.columnGap || styles.gap) || 0,
    spine: parseFloat(root.getPropertyValue("--spine")) || 50,
    cover: coverEl?.offsetWidth || 248,
    count: BOOKS.length,
    clientWidth: row.clientWidth,
  };
  // Pixel values so flex-basis can interpolate (min()/calc() --cover-w cannot).
  row.style.setProperty("--slot-spine", `${metrics.spine}px`);
  row.style.setProperty("--slot-cover", `${metrics.cover}px`);
  return metrics;
}

function slotWidth(metrics: Metrics, from: number, to: number, index: number, e: number): number {
  if (index === to && index === from) return metrics.cover;
  if (index === to) return metrics.spine + (metrics.cover - metrics.spine) * e;
  if (index === from) return metrics.cover + (metrics.spine - metrics.cover) * e;
  return metrics.spine;
}

function slotCenterAt(
  metrics: Metrics,
  from: number,
  to: number,
  index: number,
  e: number,
): number {
  let x = metrics.padL;
  for (let i = 0; i < index; i++) x += slotWidth(metrics, from, to, i, e) + metrics.gap;
  return x + slotWidth(metrics, from, to, index, e) / 2;
}

function writeSlotWidths(
  slots: NodeListOf<HTMLElement> | HTMLElement[],
  metrics: Metrics,
  from: number,
  to: number,
  e: number,
) {
  slots.forEach((slot, i) => {
    slot.style.flexBasis = `${slotWidth(metrics, from, to, i, e)}px`;
  });
}

function clearSlotWidths(slots: NodeListOf<HTMLElement> | HTMLElement[]) {
  slots.forEach((slot) => {
    slot.style.flexBasis = "";
  });
}

/** Spine midpoint of slot `index` in the layout where `openIndex` is the wide cover. */
function spineMid(metrics: Metrics, openIndex: number, index: number): number {
  let x = metrics.padL;
  for (let i = 0; i < index; i++) {
    x += (i === openIndex ? metrics.cover : metrics.spine) + metrics.gap;
  }
  return x + metrics.spine / 2;
}

function nearestIndex(scrollLeft: number, metrics: Metrics, openIndex: number): number {
  const max = maxScroll(metrics);
  if (scrollLeft <= 1) return 0;
  if (scrollLeft >= max - 1) return metrics.count - 1;
  const viewCenter = scrollLeft + metrics.clientWidth / 2;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < metrics.count; i++) {
    const dist = Math.abs(spineMid(metrics, openIndex, i) - viewCenter);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
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
  const metricsRef = useRef<Metrics | null>(null);
  const focusedRef = useRef(focused);
  const visualRef = useRef(visual);
  const skipUrlSelect = useRef(false);
  const animating = useRef(false);
  const rafRef = useRef(0);
  const visualRaf = useRef(0);
  const settleTimer = useRef(0);
  const pendingAnim = useRef<{ from: number; to: number; startScroll: number } | null>(null);
  const ignoreSettle = useRef(false);
  const ignoreSettleTimer = useRef(0);
  const pointers = useRef(0);

  focusedRef.current = focused;
  visualRef.current = visual;

  const refreshMetrics = useCallback(() => {
    const row = shelfRef.current;
    if (row) metricsRef.current = readMetrics(row);
    return metricsRef.current;
  }, []);

  const cancelAnim = useCallback(() => {
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    animating.current = false;
  }, []);

  const lockSettle = useCallback((ms: number) => {
    ignoreSettle.current = true;
    window.clearTimeout(ignoreSettleTimer.current);
    ignoreSettleTimer.current = window.setTimeout(() => {
      ignoreSettle.current = false;
    }, ms);
  }, []);

  const unlockSettle = useCallback(() => {
    window.clearTimeout(ignoreSettleTimer.current);
    ignoreSettle.current = false;
  }, []);

  const applyFocus = useCallback(
    (index: number) => {
      const next = clampIndex(index);
      focusedRef.current = next;
      visualRef.current = next;
      setFocused(next);
      setVisual(next);
      skipUrlSelect.current = true;
      navigate({ pathname: "/", search: `?book=${BOOKS[next].id}` }, { replace: true });
    },
    [navigate],
  );

  const runScrollAnim = useCallback(
    (
      row: HTMLElement,
      duration: number,
      scrollAt: (e: number) => number,
      onDone?: () => void,
    ) => {
      cancelAnim();
      if (prefersReducedMotion() || duration <= 0) {
        row.scrollLeft = scrollAt(1);
        animating.current = false;
        onDone?.();
        return;
      }
      animating.current = true;
      lockSettle(duration + 80);
      row.scrollLeft = scrollAt(0);
      const start = performance.now();
      const tick = (now: number) => {
        const e = EASE(Math.min(1, (now - start) / duration));
        row.scrollLeft = scrollAt(e);
        if (e < 1 && animating.current) {
          rafRef.current = window.requestAnimationFrame(tick);
          return;
        }
        row.scrollLeft = scrollAt(1);
        animating.current = false;
        onDone?.();
        lockSettle(80);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    },
    [cancelAnim, lockSettle],
  );

  const selectBook = useCallback(
    (index: number) => {
      const next = clampIndex(index);
      const row = shelfRef.current;
      const from = focusedRef.current;
      window.clearTimeout(settleTimer.current);
      if (!row) {
        applyFocus(next);
        return;
      }
      const metrics = refreshMetrics();
      if (!metrics) {
        applyFocus(next);
        return;
      }
      if (prefersReducedMotion()) {
        applyFocus(next);
        row.scrollLeft = clampScroll(
          slotCenterAt(metrics, next, next, next, 1) - metrics.clientWidth / 2,
          metrics,
        );
        return;
      }
      if (from === next) {
        applyFocus(next);
        row.scrollLeft = clampScroll(
          slotCenterAt(metrics, next, next, next, 1) - metrics.clientWidth / 2,
          metrics,
        );
        return;
      }
      pendingAnim.current = { from, to: next, startScroll: row.scrollLeft };
      applyFocus(next);
    },
    [applyFocus, refreshMetrics],
  );

  const stepBook = useCallback(
    (delta: number) => {
      const metrics = metricsRef.current ?? refreshMetrics();
      const row = shelfRef.current;
      const from = row && metrics
        ? nearestIndex(row.scrollLeft, metrics, focusedRef.current)
        : focusedRef.current;
      selectBook(from + delta);
    },
    [refreshMetrics, selectBook],
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
    const pending = pendingAnim.current;
    pendingAnim.current = null;
    if (!pending) return;
    const metrics = metricsRef.current;
    if (!metrics) return;
    const { from, to, startScroll } = pending;
    const startView = startScroll + metrics.clientWidth / 2;
    const origin = slotCenterAt(metrics, from, to, from, 0);
    const drift = startView - origin;
    const slots = row.querySelectorAll<HTMLElement>(".book-slot");
    const paint = (e: number) => {
      writeSlotWidths(slots, metrics, from, to, e);
      const fromCenter = slotCenterAt(metrics, from, to, from, e);
      const destCenter = slotCenterAt(metrics, from, to, to, e);
      const world = fromCenter + (destCenter - fromCenter) * e + drift * (1 - e);
      return clampScroll(world - metrics.clientWidth / 2, metrics);
    };
    runScrollAnim(row, SHELF_MS, paint, () => clearSlotWidths(slots));
  }, [focused, runScrollAnim]);

  useLayoutEffect(() => {
    const row = shelfRef.current;
    const metrics = refreshMetrics();
    if (!row || !metrics) return;
    row.scrollLeft = clampScroll(
      slotCenterAt(metrics, focusedRef.current, focusedRef.current, focusedRef.current, 1) -
        metrics.clientWidth / 2,
      metrics,
    );
  }, [refreshMetrics]);

  useEffect(() => {
    const row = shelfRef.current;
    if (!row) return;
    refreshMetrics();

    const settleFromSwipe = () => {
      if (animating.current || pointers.current > 0) return;
      if (ignoreSettle.current) return;
      const metrics = metricsRef.current;
      if (!metrics) return;
      const nearest = nearestIndex(row.scrollLeft, metrics, focusedRef.current);
      visualRef.current = nearest;
      setVisual(nearest);
      if (nearest !== focusedRef.current) {
        selectBook(nearest);
        return;
      }
      const target = clampScroll(
        slotCenterAt(metrics, nearest, nearest, nearest, 1) - metrics.clientWidth / 2,
        metrics,
      );
      if (Math.abs(row.scrollLeft - target) < 1) return;
      const start = row.scrollLeft;
      runScrollAnim(row, SETTLE_MS, (e) => start + (target - start) * e);
    };

    const armSettle = (delay: number) => {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(settleFromSwipe, delay);
    };

    const onScroll = () => {
      if (visualRaf.current) return;
      visualRaf.current = window.requestAnimationFrame(() => {
        visualRaf.current = 0;
        const metrics = metricsRef.current;
        if (!metrics || animating.current) return;
        const nearest = nearestIndex(row.scrollLeft, metrics, focusedRef.current);
        if (nearest !== visualRef.current) {
          visualRef.current = nearest;
          setVisual(nearest);
        }
      });
      if (animating.current || ignoreSettle.current) return;
      if (pointers.current > 0) return;
      armSettle(140);
    };

    const onScrollEnd = () => {
      if (pointers.current > 0) return;
      window.clearTimeout(settleTimer.current);
      settleFromSwipe();
    };

    const onPointerDown = () => {
      pointers.current += 1;
      unlockSettle();
      window.clearTimeout(settleTimer.current);
      if (animating.current) cancelAnim();
    };
    const onPointerUp = () => {
      pointers.current = Math.max(0, pointers.current - 1);
      if (pointers.current === 0) armSettle(160);
    };

    const onResize = () => {
      if (animating.current) return;
      const metrics = refreshMetrics();
      if (!metrics) return;
      row.scrollLeft = clampScroll(
        slotCenterAt(metrics, focusedRef.current, focusedRef.current, focusedRef.current, 1) -
          metrics.clientWidth / 2,
        metrics,
      );
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(row);
    row.addEventListener("scroll", onScroll, { passive: true });
    row.addEventListener("scrollend", onScrollEnd);
    row.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(settleTimer.current);
      window.clearTimeout(ignoreSettleTimer.current);
      window.cancelAnimationFrame(visualRaf.current);
      cancelAnim();
      ro.disconnect();
      row.removeEventListener("scroll", onScroll);
      row.removeEventListener("scrollend", onScrollEnd);
      row.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("resize", onResize);
    };
  }, [cancelAnim, refreshMetrics, runScrollAnim, selectBook, unlockSettle]);

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
