// Grifando's privacy page, src/app/privacy/page.tsx and
// src/components/privacy/DeleteMyDataButton.tsx (74dbb9f), ported from source under
// docs/adr/0025, decision 5: no baseline test renders them, so these assert Grifando's copy,
// roles and calls. The page belongs to the hosted profile. Its copy departs from Grifando's
// where Grifando's facts no longer hold: which provider each key reaches, the hashed IP the rate
// limits keep, and no analytics; and the local profile keeps its facts on Setup & privacy
// (docs/adr/0036).
import type { DeployProfile } from "@grifando/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AcademyRequestError } from "../features/academy/academy-client";
import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import type { InMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { getStoredAIKey, saveAIKey } from "../features/settings/ai-key-store";
import { createAppRouter } from "../router";

const FAILURE =
  "We couldn't delete your data right now. Try again in a minute.";
const WARNING =
  "This permanently deletes everything stored for you and removes your AI key from this browser. It cannot be undone.";
const RATE_LIMITED = "You're going a bit fast. Wait a moment and try again.";

const renderAt = (
  path: string,
  {
    academyClient = createInMemoryAcademyClient(),
    deployProfile = "hosted",
  }: {
    readonly academyClient?: InMemoryAcademyClient;
    readonly deployProfile?: DeployProfile;
  } = {}
) => {
  const router = createAppRouter({
    academyClient,
    deployProfile,
    evaluationClient: createInMemoryEvaluationClient({
      setupStatus: {
        configured: false,
        dataLocation: "/data/pglite",
        model: "openai/gpt-5.6-terra",
        provider: "OpenRouter",
        rubricVersion: "1",
      },
    }),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return router;
};

const paragraphs = (container: HTMLElement) =>
  within(container)
    .getAllByRole("paragraph")
    .map((paragraph) => paragraph.textContent);

// The full reload that follows a deletion, recorded instead of performed.
const recordReloads = () => {
  const assign = vi.fn<(url: string) => void>();
  vi.stubGlobal("location", { assign });
  return assign;
};

const confirmDeletion = async () => {
  await userEvent.click(
    await screen.findByRole("button", { name: "Delete my data" })
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Yes, delete everything" })
  );
};

// The primary navigation's links, as label and destination.
const primaryLinks = async () =>
  within(await screen.findByRole("navigation", { name: "Primary navigation" }))
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")]);

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("/privacy", () => {
  it("says what is stored, what each provider receives and how long data is kept, in English", async () => {
    renderAt("/privacy");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Privacy" })
    ).toBeVisible();
    expect(
      screen.getByText(
        "No sign-up, no email. Here is what Grifando keeps, what it sends out, and how to wipe it."
      )
    ).toBeVisible();
    expect(
      paragraphs(screen.getByRole("region", { name: "What we store" }))
    ).toStrictEqual([
      "The texts you write, their Evaluations, your Mistake Patterns, exercises and attempts, your interview practice answers, and your vocabulary. They are kept under a random id held in a cookie in your browser. We do not ask for or store your name, email or any login.",
      "To limit requests, we also keep a hash of your IP address, with counts of your recent requests, for 2 days.",
    ]);
    expect(
      paragraphs(
        screen.getByRole("region", { name: "What we send to an AI provider" })
      )
    ).toStrictEqual([
      "To give feedback on your writing and make exercises, your text is sent to the AI provider of the key you saved, using your own key. An OpenRouter key sends it to OpenRouter, which routes it to the AI models that give the feedback and write the exercises. A Gemini or Anthropic key sends to Google or Anthropic only what the Academy needs to write exercises, explain your answers and ask interview questions.",
      "OpenRouter says it keeps what you send only if you opt in, but the model providers it routes your text to have their own logging and retention policies.",
      "On Gemini’s free tier, Google may use what you send to improve its products. Use a paid key or Anthropic for anything sensitive.",
    ]);
    expect(
      paragraphs(screen.getByRole("region", { name: "What we never store" }))
    ).toStrictEqual([
      "Your AI key. It stays in this browser, travels with each request to your provider, and is not saved or logged on our side.",
    ]);
    expect(
      paragraphs(screen.getByRole("region", { name: "Analytics" }))
    ).toStrictEqual(["We collect no analytics or telemetry."]);
    const retention = screen.getByRole("region", {
      name: "How long we keep it",
    });
    expect(paragraphs(retention)).toStrictEqual([
      "Data is deleted automatically after 90 days without activity. You can delete it right now:",
    ]);
    expect(
      within(retention).getByRole("button", { name: "Delete my data" })
    ).toBeEnabled();
  });

  it("says the same in Portuguese, where the button stays above", async () => {
    renderAt("/privacy");

    const heading = await screen.findByRole("heading", {
      level: 2,
      name: "Privacidade",
    });
    const portuguese = heading.parentElement ?? document.body;
    expect(portuguese).toHaveAttribute("lang", "pt-BR");
    expect(
      paragraphs(
        within(portuguese).getByRole("region", { name: "O que guardamos" })
      )
    ).toStrictEqual([
      "Os textos que você escreve, as avaliações, seus padrões de erro, exercícios e tentativas, suas respostas nas entrevistas de treino e seu vocabulário. Tudo fica ligado a um id aleatório guardado em um cookie no seu navegador. Não pedimos nem guardamos nome, e-mail ou login.",
      "Para limitar o número de pedidos, também guardamos por 2 dias um hash do seu endereço IP, com a contagem dos seus pedidos recentes.",
    ]);
    expect(
      paragraphs(
        within(portuguese).getByRole("region", {
          name: "O que enviamos a um provedor de IA",
        })
      )
    ).toStrictEqual([
      "Para dar feedback sobre sua escrita e criar exercícios, seu texto é enviado ao provedor de IA da chave que você salvou, usando a sua própria chave. Uma chave do OpenRouter envia o texto ao OpenRouter, que o encaminha aos modelos de IA que dão o feedback e criam os exercícios. Uma chave do Gemini ou da Anthropic envia ao Google ou à Anthropic só o que a Academy precisa para criar exercícios, explicar suas respostas e fazer perguntas de entrevista.",
      "O OpenRouter diz que só guarda o que você envia se você ativar essa opção, mas os provedores de modelo para os quais ele encaminha seu texto têm suas próprias políticas de registro e retenção.",
      "No plano gratuito do Gemini, o Google pode usar o que você envia para melhorar os produtos dele. Use uma chave paga ou a Anthropic para qualquer coisa sensível.",
    ]);
    expect(
      paragraphs(
        within(portuguese).getByRole("region", {
          name: "O que nunca guardamos",
        })
      )
    ).toStrictEqual([
      "Sua chave de IA. Ela fica só neste navegador, vai junto de cada pedido ao seu provedor e não é salva nem registrada do nosso lado.",
    ]);
    expect(
      paragraphs(
        within(portuguese).getByRole("region", { name: "Métricas de uso" })
      )
    ).toStrictEqual(["Não coletamos métricas de uso nem telemetria."]);
    const retention = within(portuguese).getByRole("region", {
      name: "Por quanto tempo guardamos",
    });
    expect(paragraphs(retention)).toStrictEqual([
      "Os dados são apagados automaticamente após 90 dias sem atividade. Para apagar agora, use o botão “Delete my data” acima.",
    ]);
    expect(within(retention).queryByRole("button")).not.toBeInTheDocument();
  });

  it("deletes everything once confirmed, then clears the key and reloads at the start", async () => {
    saveAIKey({ apiKey: "sk-or-v1-test", provider: "openrouter" });
    const client = createInMemoryAcademyClient({ deletions: [null] });
    renderAt("/privacy", { academyClient: client });
    await userEvent.click(
      await screen.findByRole("button", { name: "Delete my data" })
    );

    expect(screen.getByText(WARNING)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Delete my data" })
    ).not.toBeInTheDocument();
    expect(client.deletionRequests).toStrictEqual([]);

    const reloads = recordReloads();
    await userEvent.click(
      screen.getByRole("button", { name: "Yes, delete everything" })
    );

    await waitFor(() => {
      expect(reloads).toHaveBeenCalledWith("/");
    });
    expect(reloads).toHaveBeenCalledTimes(1);
    expect(client.deletionRequests).toStrictEqual([
      { apiKey: "sk-or-v1-test", provider: "openrouter" },
    ]);
    expect(getStoredAIKey()).toBeNull();
  });

  it("holds both buttons while the deletion runs", async () => {
    const { promise, resolve } = Promise.withResolvers<undefined>();
    const client = createInMemoryAcademyClient({ deletions: [promise] });
    renderAt("/privacy", { academyClient: client });
    const reloads = recordReloads();
    await confirmDeletion();

    expect(
      await screen.findByRole("button", { name: "Deleting…" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(reloads).not.toHaveBeenCalled();

    resolve(undefined);

    await waitFor(() => {
      expect(reloads).toHaveBeenCalledWith("/");
    });
  });

  it("keeps the key and shows the route's message when the deletion is rate limited", async () => {
    saveAIKey({ apiKey: "sk-or-v1-test", provider: "openrouter" });
    const client = createInMemoryAcademyClient({
      deletions: [new AcademyRequestError(429, { error: RATE_LIMITED })],
    });
    renderAt("/privacy", { academyClient: client });
    const reloads = recordReloads();
    await confirmDeletion();

    expect(await screen.findByRole("alert")).toHaveTextContent(RATE_LIMITED);
    expect(
      screen.getByRole("button", { name: "Yes, delete everything" })
    ).toBeEnabled();
    expect(screen.getByText(WARNING)).toBeVisible();
    expect(getStoredAIKey()).toStrictEqual({
      apiKey: "sk-or-v1-test",
      provider: "openrouter",
    });
    expect(reloads).not.toHaveBeenCalled();
  });

  it("shows Grifando's message for any other failure, and cancels back to the button", async () => {
    const client = createInMemoryAcademyClient({
      deletions: [
        new AcademyRequestError(500, {
          code: "INTERNAL_ERROR",
          error: "Internal error",
        }),
        new TypeError("Failed to fetch"),
      ],
    });
    renderAt("/privacy", { academyClient: client });
    const reloads = recordReloads();
    await confirmDeletion();

    expect(await screen.findByRole("alert")).toHaveTextContent(FAILURE);

    await userEvent.click(
      screen.getByRole("button", { name: "Yes, delete everything" })
    );

    await waitFor(() => {
      expect(client.deletionRequests).toHaveLength(2);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(FAILURE);
    expect(reloads).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("button", { name: "Delete my data" })
    ).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it("sends the local profile to Setup & privacy, which states its facts", async () => {
    const router = renderAt("/privacy", { deployProfile: "local" });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Setup & privacy" })
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/setup");
    expect(
      screen.queryByRole("button", { name: "Delete my data" })
    ).not.toBeInTheDocument();
  });
});

describe("Setup & privacy in the hosted profile", () => {
  it("sends the hosted profile to /privacy, which replaces the local facts there", async () => {
    const router = renderAt("/setup");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Privacy" })
    ).toBeVisible();
    expect(router.state.location.pathname).toBe("/privacy");
    expect(
      screen.queryByText(
        "This app is available on localhost and has no authentication."
      )
    ).not.toBeInTheDocument();
  });
});

describe("Primary navigation per Deploy Profile", () => {
  it("links the hosted profile's key settings and privacy pages in place of Setup & privacy", async () => {
    renderAt("/privacy");

    expect(await primaryLinks()).toStrictEqual([
      ["Writing Desk", "/"],
      ["History", "/evaluations"],
      ["Progress", "/progress"],
      ["Academy", "/academy"],
      ["Key settings", "/settings"],
      ["Privacy", "/privacy"],
    ]);
  });

  it("keeps Setup & privacy in the local profile", async () => {
    renderAt("/setup", { deployProfile: "local" });

    expect(await primaryLinks()).toStrictEqual([
      ["Writing Desk", "/"],
      ["History", "/evaluations"],
      ["Progress", "/progress"],
      ["Academy", "/academy"],
      ["Setup & privacy", "/setup"],
    ]);
  });
});
