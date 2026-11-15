import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

describe("web shell", () => {
  it("renders the Writing Desk at the root route", async () => {
    const router = createAppRouter({
      evaluationClient: createInMemoryEvaluationClient(),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Writing Desk" })
    ).toBeInTheDocument();
  });
});
