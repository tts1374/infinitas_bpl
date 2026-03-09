import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppBootstrap } from "./app/AppBootstrap";
import "./styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container not found.");
}

createRoot(container).render(
  <StrictMode>
    <AppBootstrap />
  </StrictMode>,
);
