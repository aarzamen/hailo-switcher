import React from "react";
import ReactDOM from "react-dom/client";
import { initializeTheme } from "./lib/utils/theme";
import App from "./App";

// Initialize theme before render to prevent flash
initializeTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
