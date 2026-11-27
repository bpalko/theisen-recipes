import type { FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FILTER_PILLS, type BookId } from "../../shared/books.ts";

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const onShelf = location.pathname === "/";
  const activeFilter = (params.get("book") as BookId | "all" | null) ?? "all";

  function goToFilter(id: "all" | BookId) {
    if (!onShelf) {
      navigate(id === "all" ? "/" : `/?book=${id}`);
      return;
    }
    const next = new URLSearchParams(params);
    if (id === "all") next.delete("book");
    else next.set("book", id);
    navigate({ pathname: "/", search: next.toString() }, { replace: true });
  }

  async function signOut(event: FormEvent) {
    event.preventDefault();
    await fetch("/api/logout", {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    window.location.href = "/";
  }

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        Theisen Recipes
      </Link>

      <nav className="pills" aria-label="Recipe books">
        {FILTER_PILLS.map((pill) => (
          <button
            key={pill.id}
            type="button"
            className={pill.id === activeFilter && onShelf ? "pill is-active" : "pill"}
            onClick={() => goToFilter(pill.id)}
          >
            {pill.label}
          </button>
        ))}
      </nav>

      <div className="header-actions">
        <NavLink className="text-link" to="/add">
          Add recipe
        </NavLink>
        <NavLink className="text-link" to="/index">
          A–Z Index <span aria-hidden="true">↗</span>
        </NavLink>
        <form onSubmit={signOut}>
          <button className="icon-btn" type="submit" title="Sign out">
            Lock
          </button>
        </form>
      </div>
    </header>
  );
}
