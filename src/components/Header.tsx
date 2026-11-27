import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FILTER_PILLS, normalizeBookId, type BookId } from "../../shared/books.ts";
import { dismissKeyboard } from "../visualViewport.ts";

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const onShelf = location.pathname === "/";
  const activeFilter = (normalizeBookId(params.get("book")) ?? "all") as "all" | BookId;

  function goToFilter(id: "all" | BookId) {
    dismissKeyboard();
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
      <Link className="brand" to="/" onClick={() => dismissKeyboard()}>
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
        <NavLink className="add-btn" to="/add">
          Add recipe
        </NavLink>
        <a className="icon-btn" href="/cdn-cgi/access/logout" title="Sign out">
          Sign out
        </a>
      </div>
    </header>
  );
}
