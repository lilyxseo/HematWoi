/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useCallback } from "react";

export const LEVEL_BASE = 50; // adjustable constant

export const UserProfileContext = createContext({
  profile: { xp: 0, level: 1 },
  addXP: () => {},
});

export default function UserProfileProvider({ children }) {
  const [profile, setProfile] = useState({ xp: 0, level: 1 });

  const addXP = useCallback((amount = 0) => {
    setProfile((prev) => {
      const totalXP = prev.xp + amount;
      const level = Math.floor(Math.sqrt(totalXP / LEVEL_BASE)) + 1;
      return { ...prev, xp: totalXP, level };
    });
  }, []);

  return (
    <UserProfileContext.Provider value={{ profile, addXP }}>
      {children}
    </UserProfileContext.Provider>
  );
}
