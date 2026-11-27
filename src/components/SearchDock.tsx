import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

type SearchQueryValue = {
  query: string;
  setQuery: (value: string) => void;
};

const SearchQueryContext = createContext<SearchQueryValue | null>(null);

export function SearchQueryProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <SearchQueryContext.Provider value={value}>{children}</SearchQueryContext.Provider>;
}

export function useSearchQuery(): SearchQueryValue {
  const ctx = useContext(SearchQueryContext);
  if (!ctx) throw new Error("useSearchQuery must be used within SearchQueryProvider");
  return ctx;
}

export function SearchDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, setQuery } = useSearchQuery();

  useEffect(() => {
    if (location.pathname !== "/index") {
      setQuery("");
      return;
    }
    if (document.activeElement === inputRef.current) return;
    setQuery(params.get("q") ?? "");
  }, [location.pathname, params, setQuery]);

  const onIndex = location.pathname === "/index";

  function openIndex(nextQuery = query) {
    const search = nextQuery.trim() ? `?q=${encodeURIComponent(nextQuery)}` : "";
    if (location.pathname !== "/index") {
      navigate(`/index${search}`);
      return;
    }
    const current = params.get("q") ?? "";
    if (current === nextQuery) return;
    navigate({ pathname: "/index", search }, { replace: true });
  }

  function closeSearch() {
    setQuery("");
    inputRef.current?.blur();
    navigate("/");
  }

  useEffect(() => {
    if (!onIndex) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setQuery("");
      inputRef.current?.blur();
      navigate("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onIndex, navigate, setQuery]);

  return (
    <form
      className="search-dock print-hide"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        openIndex();
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
            onFocus={() => openIndex()}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              openIndex(value);
            }}
          />
        </label>
        {onIndex ? (
          <button type="button" className="search-dock-close" onClick={closeSearch}>
            Close
          </button>
        ) : null}
      </div>
    </form>
  );
}
