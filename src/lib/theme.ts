export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "blog-theme";

export const getThemeFromSystem = (): Theme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const applyTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = localStorage.getItem(THEME_STORAGE_KEY) ?? "system";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#000000" : "#ffffff");
  window.dispatchEvent(new CustomEvent("blog:theme-change", { detail: { theme } }));
};

export const readTheme = (): Theme => {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return getThemeFromSystem();
};

export const toggleTheme = (): Theme => {
  const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
  applyTheme(next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
  document.documentElement.dataset.themeMode = next;
  return next;
};
