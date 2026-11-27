import type { BookDefinition } from "../../shared/books.ts";

export function CoverArt({ book, count }: { book: BookDefinition; count: number }) {
  return (
    <div
      className={`cover-art pattern-${book.pattern}`}
      style={{ background: book.color, color: book.ink }}
    >
      <div className="cover-num">{book.number}</div>
      <p className="cover-kicker">{book.coverKicker}</p>
      <h2 className={book.title.includes(" ") ? undefined : "is-one-word"}>{book.title}</h2>
      <p className="cover-desc">{book.description}</p>
      <p className="cover-count">
        {count} {count === 1 ? "recipe" : "recipes"}
      </p>
    </div>
  );
}
