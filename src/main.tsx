import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { RecipeProvider } from "./data/RecipeContext.tsx";
import "./index.css";
import "./visualViewport.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <RecipeProvider>
        <App />
      </RecipeProvider>
    </BrowserRouter>
  </StrictMode>,
);
