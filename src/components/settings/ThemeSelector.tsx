import React from "react";
import { THEMES, type ThemeId } from "@/themes";
import { applyTheme, getCurrentTheme } from "@/lib/utils/theme";

export const ThemeSelector: React.FC = () => {
  const [current, setCurrent] = React.useState<ThemeId>(getCurrentTheme());

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value as ThemeId;
    applyTheme(id);
    setCurrent(id);
  };

  return (
    <div className="flex items-center justify-between px-4 p-2">
      <div>
        <h3 className="text-sm font-medium">Theme</h3>
        <p className="text-xs text-mid-gray">Switch visual theme</p>
      </div>
      <select
        value={current}
        onChange={handleChange}
        className="bg-mid-gray/10 border border-mid-gray/80 rounded-md px-2 py-1 text-sm text-text hover:bg-logo-primary/10 hover:border-logo-primary focus:bg-logo-primary/20 focus:border-logo-primary focus:outline-none transition-colors"
      >
        {Object.entries(THEMES).map(([id, theme]) => (
          <option key={id} value={id}>
            {theme.label}
          </option>
        ))}
      </select>
    </div>
  );
};
