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
          <span className="nav-full">
            A–Z Index <span aria-hidden="true">↗</span>
          </span>
          <span className="nav-short">Index</span>
        </NavLink>
        <a className="icon-btn" href="/cdn-cgi/access/logout" title="Sign out">
          Sign out
        </a>
      </div>
    </header>
  );
}
