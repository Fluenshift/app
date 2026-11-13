import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import { createAppRouter } from "./router";

const router = createAppRouter();
const element = document.querySelector("#app");

if (element !== null) {
  createRoot(element).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}
