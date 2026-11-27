import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { resetDocumentScroll } from "../visualViewport.ts";

type SearchQueryValue = {
  query: string;
  setQuery: (value: string) => void;
  searching: boolean;
  openSearch: () => void;
  closeSearch: () => void;
};

const SearchQueryContext = createContext<SearchQueryValue | null>(null);

export function SearchQueryProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const openSearch = useCallback(() => {
    setSearching(true);
  }, []);

  const closeSearch = useCallback(() => {
    setQuery("");
    setSearching(false);
    resetDocumentScroll();
  }, []);

  const value = useMemo(
    () => ({ query, setQuery, searching, openSearch, closeSearch }),
    [query, searching, openSearch, closeSearch],
  );
  return <SearchQueryContext.Provider value={value}>{children}</SearchQueryContext.Provider>;
}

export function useSearchQuery(): SearchQueryValue {
  const ctx = useContext(SearchQueryContext);
  if (!ctx) throw new Error("useSearchQuery must be used within SearchQueryProvider");
  return ctx;
}

export function SearchDock() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery, searching, openSearch, closeSearch } = useSearchQuery();

  function dismiss() {
    closeSearch();
    inputRef.current?.blur();
  }

  useEffect(() => {
    if (!searching) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      inputRef.current?.blur();
      closeSearch();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searching, closeSearch]);

  return (
    <form
      className="search-dock print-hide"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        openSearch();
        inputRef.current?.blur();
      }}
    >
      <div className="search-dock-bar">
        <label className="search-dock-field">
          <span className="sr-only">Search recipes</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder="Search recipes"
            autoComplete="off"
            enterKeyHint="search"
            onFocus={() => {
              openSearch();
              resetDocumentScroll();
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              openSearch();
            }}
          />
        </label>
        <button
          type="button"
          className="search-dock-close"
          onClick={dismiss}
          tabIndex={searching ? 0 : -1}
          aria-hidden={searching ? undefined : true}
          disabled={!searching}
        >
          Close
        </button>
      </div>
    </form>
  );
}
