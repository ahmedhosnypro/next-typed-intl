"use client";

import { MoonIcon, SunIcon } from "@/components/icons";
import { useTheme } from "@/components/theme";

export function ThemeToggle({ label }: { label: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="seg" role="group" aria-label={label}>
      <button
        type="button"
        className={`seg-btn${theme === "light" ? " active" : ""}`}
        aria-pressed={theme === "light"}
        aria-label="Light mode"
        title="Light mode"
        onClick={() => setTheme("light")}
      >
        <SunIcon size={15} />
      </button>
      <button
        type="button"
        className={`seg-btn${theme === "dark" ? " active" : ""}`}
        aria-pressed={theme === "dark"}
        aria-label="Dark mode"
        title="Dark mode"
        onClick={() => setTheme("dark")}
      >
        <MoonIcon />
      </button>
    </div>
  );
}
