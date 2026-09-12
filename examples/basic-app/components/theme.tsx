"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { themeCookieValue, THEME_COOKIE, type Theme } from "@/lib/theme";

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null);

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.cookie = themeCookieValue(theme);
}

export function ThemeProvider({ defaultTheme, children }: { defaultTheme: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  // The inline pre-paint script may have picked the system preference (no
  // cookie yet); align React state with the class it applied.
  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = (event: MediaQueryListEvent) => {
      if (document.cookie.includes(`${THEME_COOKIE}=`)) return;
      applyTheme(event.matches ? "dark" : "light");
      setThemeState(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    setThemeState(next);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
