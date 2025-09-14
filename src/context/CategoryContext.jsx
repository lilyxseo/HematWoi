/* eslint-disable react-refresh/only-export-components */
import { createContext } from "react";

export const CategoryContext = createContext({ getColor: () => "#64748b" });

export default function CategoryProvider({ catMeta, children }) {
  const getColor = (name) => catMeta?.[name]?.color || "#64748b";
  return (
    <CategoryContext.Provider value={{ getColor }}>
      {children}
    </CategoryContext.Provider>
  );
}
