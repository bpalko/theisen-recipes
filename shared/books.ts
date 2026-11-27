export type BookId =
  | "baking"
  | "appetizers"
  | "mains"
  | "soups"
  | "miscellaneous"
  | "holidays";

export type BookDefinition = {
  id: BookId;
  number: string;
  title: string;
  spineTitle: string;
  coverKicker: string;
  description: string;
  color: string;
  ink: string;
  accent: string;
  filterLabel: string;
  pattern: "grain" | "stripes" | "dots" | "bands" | "diamonds" | "grid";
};

/** Legacy R2 / URL slugs that should resolve to a current book. */
const LEGACY_BOOK_IDS: Record<string, BookId> = {
  desserts: "baking",
  sides: "miscellaneous",
};

export const BOOKS: BookDefinition[] = [
  {
    id: "baking",
    number: "01",
    title: "Baking",
    spineTitle: "Baking",
    coverKicker: "Theisen family kitchen",
    description: "Cinnamon rolls, lemon bars, and the cookies everyone asks for.",
    color: "#C45C26",
    ink: "#fffaf3",
    accent: "#8A3414",
    filterLabel: "Baking",
    pattern: "grain",
  },
  {
    id: "appetizers",
    number: "02",
    title: "Appetizers",
    spineTitle: "Appetizers",
    coverKicker: "Before the meal",
    description: "Dips, spreads, and the thing everyone crowds around first.",
    color: "#1A6B6B",
    ink: "#f3fbfb",
    accent: "#0E4343",
    filterLabel: "Appetizers",
    pattern: "diamonds",
  },
  {
    id: "mains",
    number: "03",
    title: "Weeknight Mains",
    spineTitle: "Weeknight Mains",
    coverKicker: "On the table by 6:30",
    description: "Skillets, tacos, and one-pan dinners for busy Theisen weeknights.",
    color: "#1E4B8E",
    ink: "#f3f7ff",
    accent: "#0F2C5C",
    filterLabel: "Mains",
    pattern: "stripes",
  },
  {
    id: "soups",
    number: "04",
    title: "Soups & Stews",
    spineTitle: "Soups & Stews",
    coverKicker: "Simmer all afternoon",
    description: "Sunday pots, crusty bread on the side, and leftovers that taste better.",
    color: "#2D5A3D",
    ink: "#f3faf5",
    accent: "#173424",
    filterLabel: "Soups & Stews",
    pattern: "dots",
  },
  {
    id: "miscellaneous",
    number: "05",
    title: "Miscellaneous",
    spineTitle: "Miscellaneous",
    coverKicker: "Everything else",
    description: "Seasoning mixes, pantry bottles, and the recipes that don’t live in another book.",
    color: "#D4A017",
    ink: "#1a1404",
    accent: "#8A6808",
    filterLabel: "Miscellaneous",
    pattern: "bands",
  },
  {
    id: "holidays",
    number: "06",
    title: "Holiday Classics",
    spineTitle: "Holiday Classics",
    coverKicker: "The once-a-year recipes",
    description: "Stuffing, Christmas morning casserole, and the table we set in November.",
    color: "#3D4C5C",
    ink: "#f4f7fb",
    accent: "#1F2A36",
    filterLabel: "Holidays",
    pattern: "grid",
  },
];

export const DEFAULT_BOOK_ID: BookId = "baking";

export const FILTER_PILLS: { id: "all" | BookId; label: string }[] = [
  { id: "all", label: "All" },
  ...BOOKS.map((book) => ({ id: book.id, label: book.filterLabel })),
];

export function getBook(id: string): BookDefinition | undefined {
  return BOOKS.find((book) => book.id === id);
}

export function bookIndex(id: string): number {
  return BOOKS.findIndex((book) => book.id === id);
}

export function normalizeBookId(value: string | null | undefined): BookId | null {
  if (!value) return null;
  const mapped = LEGACY_BOOK_IDS[value] ?? value;
  return getBook(mapped) ? (mapped as BookId) : null;
}
