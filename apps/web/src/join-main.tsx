import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { JoinPage } from "./pages/Join";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found.");
}

createRoot(container).render(
  <StrictMode>
    <JoinPage />
  </StrictMode>,
);
