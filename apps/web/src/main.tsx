import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import {
  createHttpAcademyClient,
  createHttpEvaluationClient,
  readDeployProfile,
} from "./api";

import "./index.css";
import { createAppRouter } from "./router";

// The Deploy Profile decides whether the Trainer's and the Judge's calls carry the browser's AI
// key, so it is read before the first render (docs/adr/0034, docs/adr/0035).
const deployProfile = await readDeployProfile();
const router = createAppRouter({
  academyClient: createHttpAcademyClient({ deployProfile }),
  deployProfile,
  evaluationClient: createHttpEvaluationClient({ deployProfile }),
});
const element = document.querySelector("#app");

if (element !== null) {
  createRoot(element).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}
