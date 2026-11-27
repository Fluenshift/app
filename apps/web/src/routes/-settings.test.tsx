// Grifando's key page, src/app/settings/page.tsx and src/components/settings/AIKeyForm.tsx
// (74dbb9f), ported from source under docs/adr/0025, decision 5: no baseline test renders them,
// so these assert Grifando's copy, roles and calls. The page belongs to the hosted profile; the
// local profile's key lives in server configuration (docs/adr/0034). Where it names providers,
// it offers OpenRouter first, since only an OpenRouter key runs the Judge (docs/adr/0035).
import type { DeployProfile, KeyTestStatus } from "@grifando/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AcademyRequestError } from "../features/academy/academy-client";
import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import type { InMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { getStoredAIKey, saveAIKey } from "../features/settings/ai-key-store";
import { createAppRouter } from "../router";

const renderSettings = (
  academyClient: InMemoryAcademyClient = createInMemoryAcademyClient(),
  deployProfile: DeployProfile = "hosted"
) => {
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient,
        deployProfile,
        evaluationClient: createInMemoryEvaluationClient({
          setupStatus: {
            configured: true,
            dataLocation: "/data/pglite",
            model: "openai/gpt-5.6-terra",
            provider: "OpenRouter",
            rubricVersion: "1",
          },
        }),
        history: createMemoryHistory({ initialEntries: ["/settings"] }),
      })}
    />
  );
  return academyClient;
};

const listItems = (container: HTMLElement) =>
  within(container)
    .getAllByRole("listitem")
    .map((item) => item.textContent);

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("/settings", () => {
  it("explains where the key lives and how to get each provider's key", async () => {
    renderSettings();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Your AI key" })
    ).toBeVisible();
    expect(
      screen.getByText(
        "Feedback comes from AI models that run on your own key. An OpenRouter key runs everything; a Gemini or Anthropic key runs only the Academy’s exercises, explanations and interview questions."
      )
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Where your key lives" })
    ).toHaveTextContent(
      "Your key stays only in this browser. It is sent with each AI request, passed straight to your provider, and never stored or logged on our side. Remove it here at any time."
    );
    const freeKey = screen.getByRole("region", {
      name: "Before you use a free key",
    });
    expect(freeKey).toHaveTextContent(
      "On Gemini’s free tier Google may use what you send to improve its products — use a paid key or Anthropic for anything sensitive."
    );
    expect(
      within(freeKey).getByText(
        "No plano gratuito do Gemini, o Google pode usar o que você envia para melhorar os produtos dele — use uma chave paga ou a Anthropic para qualquer coisa sensível."
      )
    ).toHaveAttribute("lang", "pt-BR");

    const openRouter = screen.getByRole("region", {
      name: "Get an OpenRouter key",
    });
    expect(listItems(openRouter)).toStrictEqual([
      "Open OpenRouter and sign in.",
      "Add credits: OpenRouter charges for each request.",
      "Create a key, paste it here, choose OpenRouter and press Save & test.",
    ]);
    const openRouterKeys = within(openRouter).getByRole("link", {
      name: "OpenRouter",
    });
    expect(openRouterKeys).toHaveAttribute(
      "href",
      "https://openrouter.ai/settings/keys"
    );
    expect(openRouterKeys).toHaveAttribute("target", "_blank");
    const openRouterPt = screen.getByRole("region", {
      name: "Como pegar uma chave do OpenRouter",
    });
    expect(openRouterPt).toHaveAttribute("lang", "pt-BR");
    expect(listItems(openRouterPt)).toStrictEqual([
      "Abra o OpenRouter e entre na sua conta.",
      "Adicione créditos: o OpenRouter cobra por pedido.",
      "Crie uma chave, cole aqui, escolha OpenRouter e clique em Save & test.",
    ]);

    const guide = screen.getByRole("region", {
      name: "Get a free Gemini key",
    });
    expect(listItems(guide)).toStrictEqual([
      "Open Google AI Studio and sign in with your Google account.",
      "Click “Create API key”.",
      "Copy the key, paste it here, choose Gemini and press Save & test.",
    ]);
    const studio = within(guide).getByRole("link", {
      name: "Google AI Studio",
    });
    expect(studio).toHaveAttribute(
      "href",
      "https://aistudio.google.com/apikey"
    );
    expect(studio).toHaveAttribute("target", "_blank");
    expect(studio).toHaveAttribute("rel", "noreferrer");

    const guidePt = screen.getByRole("region", {
      name: "Como pegar uma chave grátis do Gemini",
    });
    expect(guidePt).toHaveAttribute("lang", "pt-BR");
    expect(listItems(guidePt)).toStrictEqual([
      "Abra o Google AI Studio e entre com sua conta Google.",
      "Clique em “Create API key”.",
      "Copie a chave, cole aqui, escolha Gemini e clique em Save & test.",
    ]);
    expect(
      within(guidePt).getByRole("link", { name: "Google AI Studio" })
    ).toHaveAttribute("href", "https://aistudio.google.com/apikey");

    const anthropic = screen.getByRole("link", { name: "Anthropic Console" });
    expect(anthropic).toHaveAttribute(
      "href",
      "https://console.anthropic.com/settings/keys"
    );
    expect(anthropic.parentElement).toHaveTextContent(
      "Using Anthropic? Create a key in the Anthropic Console."
    );
  });

  it("saves a key for the chosen provider, then tests it", async () => {
    const client = renderSettings(
      createInMemoryAcademyClient({ keyTests: ["works"] })
    );
    const save = await screen.findByRole("button", { name: "Save & test" });
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(
      screen
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-checked"))
    ).toStrictEqual(["true", "false", "false"]);
    expect(
      screen.getByRole("radio", {
        name: "OpenRouter — recommended, runs everything",
      })
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Gemini — free key, Academy only" })
    ).not.toBeChecked();
    const key = screen.getByLabelText("API key");
    expect(key).toHaveAttribute("type", "password");
    expect(key).toHaveAttribute("maxlength", "256");
    expect(key).toHaveAttribute("placeholder", "Paste your key here");

    await userEvent.click(
      screen.getByRole("radio", { name: "Anthropic — Academy only" })
    );
    await userEvent.type(key, "  sk-ant-test  ");
    await userEvent.click(save);

    expect(
      await screen.findByText("Your key works. You’re all set.")
    ).toBeVisible();
    expect(client.keyTestRequests).toStrictEqual([
      { apiKey: "sk-ant-test", provider: "anthropic" },
    ]);
    expect(getStoredAIKey()).toStrictEqual({
      apiKey: "sk-ant-test",
      provider: "anthropic",
    });
    expect(key).toHaveValue("");
    expect(key).toHaveAttribute(
      "placeholder",
      "Paste a new key to replace the saved one"
    );
    expect(
      screen.getByText("An Anthropic key is saved in this browser.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();
  });

  it("tests a saved key again without a new one", async () => {
    saveAIKey({ apiKey: "sk-ant-saved", provider: "anthropic" });
    const client = renderSettings(
      createInMemoryAcademyClient({ keyTests: ["works"] })
    );

    expect(
      await screen.findByText("An Anthropic key is saved in this browser.")
    ).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "Anthropic — Academy only" })
    ).toBeChecked();
    expect(screen.getByLabelText("API key")).toHaveAttribute(
      "placeholder",
      "Paste a new key to replace the saved one"
    );
    await userEvent.click(screen.getByRole("button", { name: "Save & test" }));

    expect(
      await screen.findByText("Your key works. You’re all set.")
    ).toBeVisible();
    expect(client.keyTestRequests).toStrictEqual([
      { apiKey: "sk-ant-saved", provider: "anthropic" },
    ]);
  });

  it("saves an OpenRouter key, which runs every feature", async () => {
    const client = renderSettings(
      createInMemoryAcademyClient({ keyTests: ["works"] })
    );
    await userEvent.type(
      await screen.findByLabelText("API key"),
      "sk-or-v1-test"
    );
    await userEvent.click(screen.getByRole("button", { name: "Save & test" }));

    expect(
      await screen.findByText("Your key works. You’re all set.")
    ).toBeVisible();
    expect(client.keyTestRequests).toStrictEqual([
      { apiKey: "sk-or-v1-test", provider: "openrouter" },
    ]);
    expect(
      screen.getByText("An OpenRouter key is saved in this browser.")
    ).toBeVisible();
  });

  it("holds the form while the key is tested", async () => {
    const { promise, resolve } = Promise.withResolvers<KeyTestStatus>();
    renderSettings(createInMemoryAcademyClient({ keyTests: [promise] }));
    await userEvent.type(await screen.findByLabelText("API key"), "AIza-test");
    await userEvent.click(screen.getByRole("button", { name: "Save & test" }));

    expect(await screen.findByText("Checking your key...")).toBeVisible();
    expect(screen.getByRole("button", { name: "Testing..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByLabelText("API key")).toBeDisabled();

    resolve("works");

    expect(
      await screen.findByText("Your key works. You’re all set.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Save & test" })).toBeEnabled();
  });

  it("says why each key test failed", async () => {
    saveAIKey({ apiKey: "AIza-saved", provider: "gemini" });
    renderSettings(
      createInMemoryAcademyClient({
        keyTests: [
          "invalid",
          "busy",
          new AcademyRequestError(429, {
            error: "You're going a bit fast. Wait a moment and try again.",
          }),
          new AcademyRequestError(500, {
            code: "INTERNAL_ERROR",
            error: "Something went wrong",
          }),
        ],
      })
    );
    const save = await screen.findByRole("button", { name: "Save & test" });

    await userEvent.click(save);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This key doesn't work. Check that you copied all of it and picked the right provider."
    );
    await userEvent.click(save);
    expect(
      await screen.findByText(
        "The provider is busy, so we couldn't check the key. It's saved — try again in a minute."
      )
    ).toHaveRole("alert");
    await userEvent.click(save);
    expect(
      await screen.findByText(
        "You're going a bit fast. Wait a moment and try again."
      )
    ).toHaveRole("alert");
    await userEvent.click(save);
    expect(
      await screen.findByText(
        "We couldn't check the key right now. It's saved — try again in a minute."
      )
    ).toHaveRole("alert");
  });

  it("keeps the typed key and skips the test when the browser blocks saving it", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException(
        "The quota has been exceeded.",
        "QuotaExceededError"
      );
    });
    const client = renderSettings(
      createInMemoryAcademyClient({ keyTests: ["works"] })
    );
    const key = await screen.findByLabelText("API key");
    await userEvent.type(key, "AIza-test");
    await userEvent.click(screen.getByRole("button", { name: "Save & test" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This browser blocked saving the key (private mode or storage turned off). Allow site storage and try again."
    );
    expect(key).toHaveValue("AIza-test");
    expect(client.keyTestRequests).toStrictEqual([]);
    expect(getStoredAIKey()).toBeNull();
  });

  it("removes the key from this browser", async () => {
    saveAIKey({ apiKey: "AIza-saved", provider: "gemini" });
    renderSettings();
    await userEvent.click(
      await screen.findByRole("button", { name: "Remove" })
    );

    expect(
      await screen.findByText("Key removed from this browser.")
    ).toBeVisible();
    expect(getStoredAIKey()).toBeNull();
    expect(
      screen.queryByText("A Gemini key is saved in this browser.")
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("API key")).toHaveAttribute(
      "placeholder",
      "Paste your key here"
    );
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save & test" })).toBeDisabled();
  });

  it("sends the local profile to Setup & privacy, where the server's key is explained", async () => {
    renderSettings(createInMemoryAcademyClient(), "local");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Setup & privacy" })
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Your AI key" })
    ).not.toBeInTheDocument();
  });
});
