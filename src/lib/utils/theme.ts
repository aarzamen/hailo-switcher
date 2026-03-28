import { THEMES, DEFAULT_THEME, type ThemeId } from "@/themes";

const THEME_STORAGE_KEY = "hailo-switcher-theme";

export function applyTheme(themeId: ThemeId): void {
  const html = document.documentElement;

  // Remove all theme classes
  for (const theme of Object.values(THEMES)) {
    html.classList.remove(theme.cssClass);
  }

  // Apply selected theme
  const theme = THEMES[themeId];
  if (theme) {
    html.classList.add(theme.cssClass);
  } else {
    html.classList.add(THEMES[DEFAULT_THEME].cssClass);
  }

  // Persist
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // localStorage may not be available
  }
}

export function getCurrentTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && stored in THEMES) {
      return stored as ThemeId;
    }
  } catch {
    // fallback
  }
  return DEFAULT_THEME;
}

export function initializeTheme(): void {
  applyTheme(getCurrentTheme());
}
