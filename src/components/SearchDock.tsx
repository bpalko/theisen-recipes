import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

export function SearchDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const onIndex = location.pathname === "/index";
  const [query, setQuery] = useState(() => (onIndex ? (params.get("q") ?? "") : ""));

  useEffect(() => {
    if (location.pathname !== "/index") {
      setQuery("");
      return;
    }
    if (document.activeElement === inputRef.current) return;
    setQuery(params.get("q") ?? "");
  }, [location.pathname, params]);

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
    </form>
  );
}
