// What the hosted profile stores, what it sends out, how long it keeps it, and how to delete it
// all. Ported from Grifando src/app/privacy/page.tsx (74dbb9f), in the hosted profile only: the
// local profile's facts are on Setup & privacy (FR-24), which HR-08 replaces in the hosted
// profile. The copy departs from Grifando's where its facts no longer hold: the provider each key
// reaches (docs/adr/0035), the hashed IP the rate limits keep (docs/adr/0033), no analytics
// (docs/adr/0013), and the names of CONTEXT.md (docs/adr/0036).
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { PageHeader, PageShell } from "../features/academy/page-header";
import { DeleteMyDataButton } from "../features/privacy/delete-my-data-button";

const Block = ({
  children,
  id,
  title,
}: {
  readonly children: ReactNode;
  readonly id: string;
  readonly title: string;
}) => (
  <section aria-labelledby={id} className="space-y-3">
    <h2 className="text-heading-sm" id={id}>
      {title}
    </h2>
    <div className="text-iron space-y-3">{children}</div>
  </section>
);

const PrivacyPage = () => (
  <PageShell>
    <PageHeader
      description="No sign-up, no email. Here is what Fluenshift keeps, what it sends out, and how to wipe it."
      title="Privacy"
    />

    <div className="space-y-16 pb-24">
      <div className="max-w-[720px] space-y-10">
        <Block id="stored-en" title="What we store">
          <p>
            The texts you write, their Evaluations, your Mistake Patterns,
            exercises and attempts, your interview practice answers, and your
            vocabulary. They are kept under a random id held in a cookie in your
            browser. We do not ask for or store your name, email or any login.
          </p>
          <p>
            To limit requests, we also keep a hash of your IP address, with
            counts of your recent requests, for 2 days.
          </p>
        </Block>
        <Block id="sent-en" title="What we send to an AI provider">
          <p>
            To give feedback on your writing and make exercises, your text is
            sent to the AI provider of the key you saved, using your own key. An
            OpenRouter key sends it to OpenRouter, which routes it to the AI
            models that give the feedback and write the exercises. A Gemini or
            Anthropic key sends to Google or Anthropic only what the Academy
            needs to write exercises, explain your answers and ask interview
            questions.
          </p>
          <p>
            OpenRouter says it keeps what you send only if you opt in, but the
            model providers it routes your text to have their own logging and
            retention policies.
          </p>
          <p>
            On Gemini&rsquo;s free tier, Google may use what you send to improve
            its products. Use a paid key or Anthropic for anything sensitive.
          </p>
        </Block>
        <Block id="never-en" title="What we never store">
          <p>
            Your AI key. It stays in this browser, travels with each request to
            your provider, and is not saved or logged on our side.
          </p>
        </Block>
        <Block id="analytics-en" title="Analytics">
          <p>We collect no analytics or telemetry.</p>
        </Block>
        <Block id="retention-en" title="How long we keep it">
          <p>
            Data is deleted automatically after 90 days without activity. You
            can delete it right now:
          </p>
          <DeleteMyDataButton />
        </Block>
      </div>

      <div className="max-w-[720px] space-y-10" lang="pt-BR">
        <h2 className="text-heading">Privacidade</h2>
        <Block id="stored-pt" title="O que guardamos">
          <p>
            Os textos que você escreve, as avaliações, seus padrões de erro,
            exercícios e tentativas, suas respostas nas entrevistas de treino e
            seu vocabulário. Tudo fica ligado a um id aleatório guardado em um
            cookie no seu navegador. Não pedimos nem guardamos nome, e-mail ou
            login.
          </p>
          <p>
            Para limitar o número de pedidos, também guardamos por 2 dias um
            hash do seu endereço IP, com a contagem dos seus pedidos recentes.
          </p>
        </Block>
        <Block id="sent-pt" title="O que enviamos a um provedor de IA">
          <p>
            Para dar feedback sobre sua escrita e criar exercícios, seu texto é
            enviado ao provedor de IA da chave que você salvou, usando a sua
            própria chave. Uma chave do OpenRouter envia o texto ao OpenRouter,
            que o encaminha aos modelos de IA que dão o feedback e criam os
            exercícios. Uma chave do Gemini ou da Anthropic envia ao Google ou à
            Anthropic só o que a Academy precisa para criar exercícios, explicar
            suas respostas e fazer perguntas de entrevista.
          </p>
          <p>
            O OpenRouter diz que só guarda o que você envia se você ativar essa
            opção, mas os provedores de modelo para os quais ele encaminha seu
            texto têm suas próprias políticas de registro e retenção.
          </p>
          <p>
            No plano gratuito do Gemini, o Google pode usar o que você envia
            para melhorar os produtos dele. Use uma chave paga ou a Anthropic
            para qualquer coisa sensível.
          </p>
        </Block>
        <Block id="never-pt" title="O que nunca guardamos">
          <p>
            Sua chave de IA. Ela fica só neste navegador, vai junto de cada
            pedido ao seu provedor e não é salva nem registrada do nosso lado.
          </p>
        </Block>
        <Block id="analytics-pt" title="Métricas de uso">
          <p>Não coletamos métricas de uso nem telemetria.</p>
        </Block>
        <Block id="retention-pt" title="Por quanto tempo guardamos">
          <p>
            Os dados são apagados automaticamente após 90 dias sem atividade.
            Para apagar agora, use o botão &ldquo;Delete my data&rdquo; acima.
          </p>
        </Block>
      </div>
    </div>
  </PageShell>
);

export const Route = createFileRoute("/privacy")({
  beforeLoad: ({ context }) => {
    if (context.deployProfile === "local") {
      throw redirect({ replace: true, to: "/setup" });
    }
  },
  component: PrivacyPage,
});
