// The visitor's AI key. Ported from Grifando src/app/settings/page.tsx (74dbb9f), in the hosted
// profile only: the local profile's key lives in the server's configuration, which Setup &
// privacy explains, so the browser never stores one there (docs/adr/0034). Only an OpenRouter key
// runs the Judge, so the page leads with it, and its guide comes first (docs/adr/0035).
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PageHeader, PageShell } from "../features/academy/page-header";
import { AIKeyForm } from "../features/settings/ai-key-form";

const OPENROUTER_KEYS_URL = "https://openrouter.ai/settings/keys";
const AI_STUDIO_URL = "https://aistudio.google.com/apikey";
const ANTHROPIC_CONSOLE_URL = "https://console.anthropic.com/settings/keys";

const ExternalLink = ({
  children,
  href,
}: {
  readonly children: ReactNode;
  readonly href: string;
}) => (
  <a
    className="hover:text-iron underline underline-offset-4"
    href={href}
    rel="noreferrer"
    target="_blank"
  >
    {children}
  </a>
);

const SettingsPage = () => (
  <PageShell>
    <PageHeader
      description="Feedback comes from AI models that run on your own key. An OpenRouter key runs everything; a Gemini or Anthropic key runs only the Academy’s exercises, explanations and interview questions."
      title="Your AI key"
    />

    <div className="grid gap-x-16 gap-y-12 pb-24 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-10">
        <AIKeyForm />

        <section aria-labelledby="key-storage-title" className="space-y-3">
          <h2 className="text-heading-sm" id="key-storage-title">
            Where your key lives
          </h2>
          <p className="text-iron">
            Your key stays only in this browser. It is sent with each AI
            request, passed straight to your provider, and never stored or
            logged on our side. Remove it here at any time.
          </p>
        </section>

        <section aria-labelledby="free-tier-title" className="space-y-3">
          <h2 className="text-heading-sm" id="free-tier-title">
            Before you use a free key
          </h2>
          <p className="text-iron">
            On Gemini&rsquo;s free tier Google may use what you send to improve
            its products — use a paid key or Anthropic for anything sensitive.
          </p>
          <p className="text-iron" lang="pt-BR">
            No plano gratuito do Gemini, o Google pode usar o que você envia
            para melhorar os produtos dele — use uma chave paga ou a Anthropic
            para qualquer coisa sensível.
          </p>
        </section>
      </div>

      <aside className="rounded-card bg-linen space-y-10 px-6 py-8 md:px-8">
        <section aria-labelledby="openrouter-guide-title" className="space-y-4">
          <h2 className="text-heading-sm" id="openrouter-guide-title">
            Get an OpenRouter key
          </h2>
          <ol className="text-iron list-decimal space-y-2 pl-5">
            <li>
              Open{" "}
              <ExternalLink href={OPENROUTER_KEYS_URL}>OpenRouter</ExternalLink>{" "}
              and sign in.
            </li>
            <li>Add credits: OpenRouter charges for each request.</li>
            <li>
              Create a key, paste it here, choose OpenRouter and press Save
              &amp; test.
            </li>
          </ol>
        </section>

        <section
          aria-labelledby="openrouter-guide-pt-title"
          className="space-y-4"
          lang="pt-BR"
        >
          <h2 className="text-heading-sm" id="openrouter-guide-pt-title">
            Como pegar uma chave do OpenRouter
          </h2>
          <ol className="text-iron list-decimal space-y-2 pl-5">
            <li>
              Abra o{" "}
              <ExternalLink href={OPENROUTER_KEYS_URL}>OpenRouter</ExternalLink>{" "}
              e entre na sua conta.
            </li>
            <li>Adicione créditos: o OpenRouter cobra por pedido.</li>
            <li>
              Crie uma chave, cole aqui, escolha OpenRouter e clique em Save
              &amp; test.
            </li>
          </ol>
        </section>

        <section aria-labelledby="gemini-guide-title" className="space-y-4">
          <h2 className="text-heading-sm" id="gemini-guide-title">
            Get a free Gemini key
          </h2>
          <ol className="text-iron list-decimal space-y-2 pl-5">
            <li>
              Open{" "}
              <ExternalLink href={AI_STUDIO_URL}>Google AI Studio</ExternalLink>{" "}
              and sign in with your Google account.
            </li>
            <li>Click &ldquo;Create API key&rdquo;.</li>
            <li>
              Copy the key, paste it here, choose Gemini and press Save &amp;
              test.
            </li>
          </ol>
        </section>

        <section
          aria-labelledby="gemini-guide-pt-title"
          className="space-y-4"
          lang="pt-BR"
        >
          <h2 className="text-heading-sm" id="gemini-guide-pt-title">
            Como pegar uma chave grátis do Gemini
          </h2>
          <ol className="text-iron list-decimal space-y-2 pl-5">
            <li>
              Abra o{" "}
              <ExternalLink href={AI_STUDIO_URL}>Google AI Studio</ExternalLink>{" "}
              e entre com sua conta Google.
            </li>
            <li>Clique em &ldquo;Create API key&rdquo;.</li>
            <li>
              Copie a chave, cole aqui, escolha Gemini e clique em Save &amp;
              test.
            </li>
          </ol>
        </section>

        <p className="text-muted-foreground text-sm">
          Using Anthropic? Create a key in the{" "}
          <ExternalLink href={ANTHROPIC_CONSOLE_URL}>
            Anthropic Console
          </ExternalLink>
          .
        </p>
      </aside>
    </div>
  </PageShell>
);

export const Route = createFileRoute("/settings")({
  beforeLoad: ({ context }) => {
    if (context.deployProfile === "local") {
      throw redirect({ replace: true, to: "/setup" });
    }
  },
  component: SettingsPage,
});
