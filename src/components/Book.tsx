import type { BookDefinition } from "../../shared/books.ts";
import { CoverArt } from "./CoverArt.tsx";

type Props = {
  book: BookDefinition;
  count: number;
  focused: boolean;
  onFocus: () => void;
  onOpen: () => void;
  onCursor?: (pos: { x: number; y: number } | null) => void;
};

export function Book({ book, count, focused, onFocus, onOpen, onCursor }: Props) {
  return (
    <button
      type="button"
      className={focused ? "book-slot is-focused" : "book-slot"}
      data-focused={focused ? "true" : "false"}
      aria-pressed={focused}
      aria-label={
        focused
          ? `Open ${book.title}`
          : `Focus ${book.number} ${book.title}`
      }
      onClick={() => {
        if (focused) onOpen();
        else onFocus();
      }}
      onMouseMove={(event) => {
        if (!focused || !onCursor) return;
        onCursor({ x: event.clientX, y: event.clientY });
      }}
      onMouseLeave={() => onCursor?.(null)}
    >
      <div className="book-3d">
        <div className="book-face book-cover">
          <CoverArt book={book} count={count} />
        </div>
        <div
          className="book-face book-spine"
          style={{ background: book.color, color: book.ink }}
        >
          <span className="spine-num">{book.number}</span>
          <span className="spine-title">{book.spineTitle}</span>
          <span className="spine-count">{String(count).padStart(2, "0")}</span>
        </div>
        <div className="book-face book-pages" />
      </div>
      <span className="book-ground-shadow" />
    </button>
  );
}
