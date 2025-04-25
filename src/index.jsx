import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css"; // Tailwind import
const el = document.getElementById("root");
createRoot(el).render(<App />);
