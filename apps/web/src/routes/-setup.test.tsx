import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const SETUP = {
  configured: true,
  dataLocation: "/data/local.db",
  model: "openai/gpt-5.6-terra",
  provider: "OpenRouter",
  rubricVersion: "1",
};

describe("Setup & privacy", () => {
  test("keeps setup to essential provider, privacy, data, and access facts", async () => {
    const router = createAppRouter({
      evaluationClient: createInMemoryEvaluationClient({
        setupStatus: {
          configured: false,
          dataLocation: "/data/local.db",
          model: "openai/gpt-5.6-terra",
          provider: "OpenRouter",
          rubricVersion: "1",
        },
      }),
      history: createMemoryHistory({ initialEntries: ["/setup"] }),
    });

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Setup & privacy" })
    ).toBeInTheDocument();

    const provider = screen.getByRole("region", {
      name: "Provider",
    });
    expect(within(provider).getByText("Needs setup")).toBeInTheDocument();
    expect(provider).toHaveTextContent("OpenRouter · openai/gpt-5.6-terra");
    expect(provider).toHaveTextContent(
      "Set OPENROUTER_API_KEY in the server environment, then restart."
    );
    expect(within(provider).queryByRole("button")).not.toBeInTheDocument();
    expect(within(provider).queryByRole("textbox")).not.toBeInTheDocument();

    const facts = screen.getByRole("region", {
      name: "Data and privacy",
    });
    expect(facts).toHaveTextContent(
      "Nothing is sent while you type. Evaluating sends the full sample to OpenRouter."
    );
    expect(facts).toHaveTextContent("Nothing is sent while you type.");
    expect(facts).toHaveTextContent("/data/local.db");
    expect(facts).toHaveTextContent(
      "This app is available on localhost and has no authentication."
    );
    expect(facts).toHaveTextContent("Provider credentials stay on the server.");
    expect(facts).toHaveTextContent(
      "The provider's data policy applies after submission."
    );

    expect(screen.queryByText("Operational boundary")).not.toBeInTheDocument();
    expect(screen.queryByText("Boundary Lens")).not.toBeInTheDocument();
    expect(screen.queryByText("Context")).not.toBeInTheDocument();
    expect(screen.queryByText("Rubric Version")).not.toBeInTheDocument();
  });

  test("reports when the provider is ready", async () => {
    const router = createAppRouter({
      evaluationClient: createInMemoryEvaluationClient({
        setupStatus: {
          configured: true,
          dataLocation: "/data/local.db",
          model: "openai/gpt-5.6-terra",
          provider: "OpenRouter",
          rubricVersion: "1",
        },
      }),
      history: createMemoryHistory({ initialEntries: ["/setup"] }),
    });

    render(<RouterProvider router={router} />);

    const provider = await screen.findByRole("region", {
      name: "Provider",
    });
    expect(provider).toHaveTextContent("Ready");
    expect(provider).toHaveTextContent("OpenRouter · openai/gpt-5.6-terra");
    expect(provider).not.toHaveTextContent("then restart");
  });

  // The Academy runs on a second key, which the server holds too (docs/adr/0012, #273).
  test("asks for the Trainer's key when the server holds none", async () => {
    const router = createAppRouter({
      evaluationClient: createInMemoryEvaluationClient({
        setupStatus: { ...SETUP, trainer: { configured: false } },
      }),
      history: createMemoryHistory({ initialEntries: ["/setup"] }),
    });

    render(<RouterProvider router={router} />);

    const trainer = await screen.findByRole("region", { name: "Trainer" });
    expect(within(trainer).getByText("Needs setup")).toBeInTheDocument();
    expect(trainer).toHaveTextContent(
      "Set ANTHROPIC_API_KEY, or GEMINI_API_KEY with AI_PROVIDER=gemini, in the server environment, then restart."
    );
  });

  // Practice writing reaches the Trainer's provider, and once the Learner has practiced, every
  // Evaluation does too (docs/adr/0041).
  test("names the Trainer's provider and what the Academy sends it", async () => {
    const router = createAppRouter({
      evaluationClient: createInMemoryEvaluationClient({
        setupStatus: {
          ...SETUP,
          trainer: {
            configured: true,
            model: "claude-sonnet-5",
            provider: "Anthropic",
          },
        },
      }),
      history: createMemoryHistory({ initialEntries: ["/setup"] }),
    });

    render(<RouterProvider router={router} />);

    const trainer = await screen.findByRole("region", { name: "Trainer" });
    expect(within(trainer).getByText("Ready")).toBeInTheDocument();
    expect(trainer).toHaveTextContent("Anthropic · claude-sonnet-5");
    expect(
      screen.getByRole("region", { name: "Data and privacy" })
    ).toHaveTextContent(
      "The Academy sends practice writing to Anthropic, and once you have practiced, every Evaluation too."
    );
  });

  test("says the Trainer shares the Judge's OpenRouter key", async () => {
    const router = createAppRouter({
      evaluationClient: createInMemoryEvaluationClient({
        setupStatus: {
          ...SETUP,
          trainer: {
            configured: true,
            model: "google/gemini-3.5-flash",
            provider: "OpenRouter",
          },
        },
      }),
      history: createMemoryHistory({ initialEntries: ["/setup"] }),
    });

    render(<RouterProvider router={router} />);

    const trainer = await screen.findByRole("region", { name: "Trainer" });
    expect(trainer).toHaveTextContent("Shares the Judge's OpenRouter key");
  });
});
