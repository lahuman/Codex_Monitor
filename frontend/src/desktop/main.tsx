import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { useThemeStore } from "@/hooks/use-theme";
import i18n from "@/i18n";
import "./style.css";
import { DesktopApp } from "./App";
import { MenuBarPanel } from "./menubar-panel";
useThemeStore.getState().initializeTheme();
if (!localStorage.getItem("codex-lb-language")) void i18n.changeLanguage("ko");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      {window.location.hash.startsWith("#/menubar") ? (
        <MenuBarPanel />
      ) : (
        <DesktopApp />
      )}
    </HashRouter>
  </StrictMode>,
);
