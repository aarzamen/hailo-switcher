export const THEMES = {
  default: { label: "Default", cssClass: "theme-default" },
  darkGalaxyUltra: {
    label: "Dark Galaxy Ultra",
    cssClass: "theme-dark-galaxy-ultra",
  },
} as const;

export type ThemeId = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeId = "darkGalaxyUltra";
