import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SpectatePage } from "./pages/Spectate";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found.");
}

createRoot(container).render(
  <StrictMode>
    <SpectatePage />
  </StrictMode>,
);
