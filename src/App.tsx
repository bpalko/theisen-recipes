import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AddRecipe } from "./components/AddRecipe.tsx";
import { AzIndex } from "./components/AzIndex.tsx";
import { BookToc } from "./components/BookToc.tsx";
import { Bookshelf } from "./components/Bookshelf.tsx";
import { Header } from "./components/Header.tsx";
import { RecipeView } from "./components/RecipeView.tsx";
import { SearchDock, SearchQueryProvider, useSearchQuery } from "./components/SearchDock.tsx";

function OpenSearchHome() {
  const { openSearch } = useSearchQuery();
  useEffect(() => {
    openSearch();
  }, [openSearch]);
  return <Navigate to="/" replace />;
}

function AppShell() {
  const { searching } = useSearchQuery();

  return (
    <div className={searching ? "app-shell is-searching" : "app-shell"}>
      <Header />
      <div className="app-main">
        <div className="app-page" aria-hidden={searching || undefined}>
          <Routes>
            <Route path="/" element={<Bookshelf />} />
            <Route path="/book/:bookId" element={<BookToc />} />
            <Route path="/recipe/:slug" element={<RecipeView />} />
            <Route path="/index" element={<OpenSearchHome />} />
            <Route path="/add" element={<AddRecipe />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        {searching ? (
          <div className="search-sheet" role="dialog" aria-label="Recipe search">
            <AzIndex />
          </div>
        ) : null}
      </div>
      <SearchDock />
    </div>
  );
}

export default function App() {
  return (
    <SearchQueryProvider>
      <AppShell />
    </SearchQueryProvider>
  );
}
