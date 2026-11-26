import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { mergeRecipes, type Recipe } from "../../shared/recipes.ts";
import { fetchFamilyRecipes, seedRecipes } from "./loadRecipes.ts";

type RecipeContextValue = {
  recipes: Recipe[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const RecipeContext = createContext<RecipeContextValue | null>(null);

export function RecipeProvider({ children }: { children: ReactNode }) {
  const [family, setFamily] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const stored = await fetchFamilyRecipes();
    setFamily(stored);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recipes = useMemo(() => mergeRecipes(seedRecipes, family), [family]);

  return (
    <RecipeContext.Provider value={{ recipes, loading, refresh }}>
      {children}
    </RecipeContext.Provider>
  );
}

export function useRecipes(): RecipeContextValue {
  const value = useContext(RecipeContext);
  if (!value) throw new Error("useRecipes must be used within RecipeProvider");
  return value;
}
