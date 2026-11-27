import { Navigate, Route, Routes } from "react-router-dom";
import { AddRecipe } from "./components/AddRecipe.tsx";
import { AzIndex } from "./components/AzIndex.tsx";
import { BookToc } from "./components/BookToc.tsx";
import { Bookshelf } from "./components/Bookshelf.tsx";
import { Header } from "./components/Header.tsx";
import { RecipeView } from "./components/RecipeView.tsx";
import { SearchDock } from "./components/SearchDock.tsx";

export default function App() {
  return (
    <div className="app-shell">
      <Header />
      <div className="app-main">
        <Routes>
          <Route path="/" element={<Bookshelf />} />
          <Route path="/book/:bookId" element={<BookToc />} />
          <Route path="/recipe/:slug" element={<RecipeView />} />
          <Route path="/index" element={<AzIndex />} />
          <Route path="/add" element={<AddRecipe />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <SearchDock />
    </div>
  );
}
