import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthGate } from "./AuthGate";
import "./styles.css";

(globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);
