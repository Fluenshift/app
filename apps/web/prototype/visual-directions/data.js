// PROTOTYPE (#333), throwaway: sample data shared by every visual direction, in pt-BR (ADR 0048).
// English stays where English is the subject: the Learner's text, each Correction, the corrected
// version, English examples, Practice Prompts and Exercises. Words follow GLOSSARIO.md.
// The numbers follow docs/product/RUBRIC.md: 78 English words, error points 7+3+7+3+3 = 23,
// score round(100 - 100 * 23 / 78) = 71 (Claro), Finding Rate 5 / 78 * 100 = 6,4.
// Progress: 43 Evaluations, 3.912 words and 187 Findings over 30 days (4,8 per 100 words); the
// daily rows, the per-category series and the per-kind rates all add up to those totals.
(function () {
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const start = Date.UTC(2026, 9, 29);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(start + i * 864e5);
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
  });

  window.GRIFANDO_DATA = {
    nav: [
      { key: "desk", label: "Escrever" },
      { key: "history", label: "Histórico" },
      { key: "progress", label: "Progresso" },
      { key: "academy", label: "Treino" },
      { key: "settings", label: "Configurações" },
    ],
    textKinds: ["Prompt", "Issue", "Pull request", "Outro"],
    bands: [
      { name: "Precisa de revisão", from: 0, to: 49 },
      { name: "Compreensível", from: 50, to: 69 },
      { name: "Claro", from: 70, to: 84 },
      { name: "Natural", from: 85, to: 100 },
    ],
    severities: ["Leve", "Moderada", "Grave"],
    evaluation: {
      title: "Fix cache invalidation on profile update",
      textKind: "Pull request",
      practice: false,
      score: 71,
      band: "Claro",
      words: 78,
      findingRate: 6.4,
      // The Rubric Version's id is "1-provisional"; the interface names it in pt-BR.
      rubric: "1 (provisória)",
      codeSpans: 1,
      when: "Hoje, 14:32",
      // The Writing Sample as segments: plain text, a Finding (f), a Suggestion (s) or code.
      segments: [
        { t: "This PR " },
        { t: "fix", f: 1 },
        { t: " the cache invalidation when a user " },
        { t: "update", f: 2 },
        { t: " their profile. Before, the profile service " },
        { t: "depended of", f: 3 },
        {
          t: " the event bus, so stale entries stayed in Redis for hours. Now the handler clears the entries on each ",
        },
        { code: "profile.updated" },
        { t: " event and logs the keys it removed. I also added tests " },
        { t: "for to cover", f: 4 },
        { t: " the " },
        { t: "edge cases with deleted users", s: 1 },
        {
          t: " and concurrent updates. The migration is backwards compatible, so we can deploy it without downtime. Let me know ",
        },
        { t: "if make sense", f: 5 },
        { t: "." },
      ],
      // Explanations mark English with *asterisks*; PROTO.rich turns them into lang="en" spans.
      findings: [
        {
          n: 1,
          original: "fix",
          correction: "fixes",
          category: "Forma/tempo verbal",
          severity: "Moderada",
          explanation:
            "*This PR* é singular, na terceira pessoa. No presente, o verbo ganha -s: *fixes*.",
        },
        {
          n: 2,
          original: "update",
          correction: "updates",
          category: "Forma/tempo verbal",
          severity: "Leve",
          explanation:
            "*A user* está no singular, então o verbo também leva -s: *updates*.",
        },
        {
          n: 3,
          original: "depended of",
          correction: "depended on",
          category: "Preposição",
          severity: "Moderada",
          explanation:
            "Em inglês, *depend* pede *on*. O *of* vem do “depender de” do português.",
          l1: true,
        },
        {
          n: 4,
          original: "for to cover",
          correction: "to cover",
          category: "Preposição",
          severity: "Leve",
          explanation:
            "O *for* sobra: para dizer a finalidade, o inglês usa só *to* com o verbo. O *for to* copia o “para” do português.",
          l1: true,
        },
        {
          n: 5,
          original: "if make sense",
          correction: "if it makes sense",
          category: "Gramática/sintaxe",
          severity: "Leve",
          explanation:
            "Toda oração em inglês precisa de sujeito, e o verbo concorda com ele: *if it makes sense*.",
        },
      ],
      suggestions: [
        {
          n: 1,
          original: "edge cases with deleted users",
          alternative: "edge cases with soft-deleted users",
          why: "Se essas contas são apagadas só logicamente, *soft-deleted* nomeia o caso exato. Não é erro: depende do que você quis dizer.",
        },
      ],
      corrected:
        "This PR fixes the cache invalidation when a user updates their profile. Before, the profile service depended on the event bus, so stale entries stayed in Redis for hours. Now the handler clears the entries on each `profile.updated` event and logs the keys it removed. I also added tests to cover the edge cases with deleted users and concurrent updates. The migration is backwards compatible, so we can deploy it without downtime. Let me know if it makes sense.",
    },
    history: [
      {
        title: "Fix cache invalidation on profile update",
        kind: "Pull request",
        score: 71,
        band: "Claro",
        when: "Hoje",
      },
      {
        title: "Add retry with backoff to the webhook sender",
        kind: "Prompt",
        score: 88,
        band: "Natural",
        when: "Ontem",
      },
      {
        title: "Login fails when the email has a plus sign",
        kind: "Issue",
        score: 64,
        band: "Compreensível",
        when: "Há 2 dias",
      },
      {
        title: "Split the billing module into services",
        kind: "Pull request",
        score: 79,
        band: "Claro",
        when: "Há 3 dias",
      },
      {
        title: "Backfill the locale of existing users",
        kind: "Prompt",
        score: 92,
        band: "Natural",
        when: "Há 4 dias",
      },
    ],
    progress: {
      period: "Últimos 30 dias",
      evaluations: 43,
      words: 3912,
      findings: 187,
      findingRate: 4.8,
      averageScore: 74,
      days,
      seriesStart: days[0],
      seriesEnd: days.at(-1),
      // Finding Rate per day, 29 out to 27 nov; null is a day with no Evaluation (PC-02).
      series: [
        6.3, 6.7, null, null, 5.3, 5.5, null, 5.1, 6.1, null, null, 4.9, 5.5, null, 4.6, 5.2,
        null, null, 4.0, null, 5.0, 3.7, 4.0, null, null, 3.7, 4.2, 3.9, 3.4, 6.4,
      ],
      // Each day's [Evaluations, English words, Findings] (PC-01).
      daily: [
        [3, 158, 10], [2, 193, 13], null, null, [2, 188, 10], [3, 182, 10], null, [2, 177, 9],
        [2, 212, 13], null, null, [3, 206, 10], [2, 201, 11], null, [2, 195, 9], [3, 231, 12],
        null, null, [2, 225, 9], null, [2, 220, 11], [3, 214, 8], [2, 249, 10], null, null,
        [2, 244, 9], [3, 238, 10], [2, 233, 9], [2, 268, 9], [1, 78, 5],
      ],
      weeks: ["29 out–4 nov", "5–11 nov", "12–18 nov", "19–25 nov", "26–27 nov"],
      // Findings per Error Category per day (PC-03); each series adds up to its count.
      categories: [
        {
          name: "Preposição",
          count: 41,
          series: [2, 2, null, null, 2, 2, null, 2, 3, null, null, 2, 2, null, 2, 3, null, null, 2, null, 3, 2, 2, null, null, 2, 2, 2, 2, 2],
        },
        {
          name: "Forma/tempo verbal",
          count: 36,
          series: [2, 3, null, null, 2, 2, null, 2, 2, null, null, 2, 2, null, 2, 2, null, null, 2, null, 2, 1, 2, null, null, 2, 2, 1, 1, 2],
        },
        {
          name: "Artigo",
          count: 33,
          series: [3, 3, null, null, 3, 2, null, 2, 3, null, null, 2, 2, null, 2, 2, null, null, 1, null, 2, 1, 1, null, null, 1, 1, 1, 1, 0],
        },
        {
          name: "Gramática/sintaxe",
          count: 29,
          series: [1, 2, null, null, 1, 1, null, 1, 2, null, null, 1, 2, null, 1, 2, null, null, 1, null, 2, 1, 2, null, null, 1, 3, 2, 2, 1],
        },
        {
          name: "Escolha de palavra",
          count: 22,
          series: [1, 1, null, null, 1, 1, null, 1, 1, null, null, 1, 1, null, 1, 1, null, null, 1, null, 1, 1, 2, null, null, 1, 2, 2, 2, 0],
        },
        {
          name: "Pontuação/maiúsculas",
          count: 15,
          series: [1, 1, null, null, 1, 1, null, 1, 1, null, null, 1, 1, null, 1, 1, null, null, 1, null, 1, 1, 1, null, null, 1, 0, 0, 0, 0],
        },
        {
          name: "Clareza",
          count: 7,
          series: [0, 1, null, null, 0, 1, null, 0, 1, null, null, 0, 1, null, 0, 0, null, null, 0, null, 0, 1, 0, null, null, 0, 0, 1, 1, 0],
        },
        {
          name: "Ortografia",
          count: 4,
          series: [0, 0, null, null, 0, 0, null, 0, 0, null, null, 1, 0, null, 0, 1, null, null, 1, null, 0, 0, 0, null, null, 1, 0, 0, 0, 0],
        },
      ],
      byKind: [
        { kind: "Prompt", rate: 3.9, evaluations: 21 },
        { kind: "Issue", rate: 5.1, evaluations: 9 },
        { kind: "Pull request", rate: 6.0, evaluations: 11 },
        { kind: "Outro", rate: 4.4, evaluations: 2, few: true },
      ],
      insights: [
        {
          text: "Preposição é a categoria de erro mais recorrente: 41 erros, em 17 das 43 avaliações.",
        },
        { text: "Correção recorrente: *depend of* virou *depend on* 6 vezes." },
        {
          text: "Erros de Artigo aparecem em 14 avaliações, 9 delas de prompts.",
        },
      ],
    },
    academy: {
      challenge: {
        title: "Explain a rollback",
        prompt:
          "Last night's deploy was rolled back. Tell your team what happened and what comes next, in 3 to 5 sentences.",
        focus: "Tempo verbal",
        source: "Tema técnico: DevOps",
      },
      exercises: { ready: 8, done: 2, next: "Complete a lacuna" },
      // Mistake Patterns, lowest Recall first is how practice orders them (CONTEXT.md, Recall).
      patterns: [
        {
          example: ["This PR fix", "This PR fixes"],
          category: "Concordância verbal",
          occurrences: 9,
          last: "hoje",
          mastery: "Ativo",
          recall: 35,
        },
        {
          example: ["depend of", "depend on"],
          category: "Preposições",
          occurrences: 6,
          last: "hoje",
          mastery: "Ativo",
          recall: 48,
          l1: true,
        },
        {
          example: ["for to cover", "to cover"],
          category: "Preposições",
          occurrences: 5,
          last: "há 3 dias",
          mastery: "Melhorando",
          recall: 62,
          l1: true,
        },
        {
          example: ["if make sense", "if it makes sense"],
          category: "Pronomes",
          occurrences: 4,
          last: "há 6 dias",
          mastery: "Dominado",
          recall: 41,
          fading: true,
        },
        {
          example: ["an information", "information"],
          category: "Contável/incontável",
          occurrences: 3,
          last: "há 12 dias",
          mastery: "Dominado",
          recall: 88,
        },
      ],
      modes: [
        {
          key: "exercises",
          name: "Exercícios",
          detail: "8 prontos, feitos dos seus erros",
        },
        {
          key: "explain",
          name: "Explicar código",
          detail: "Cole um trecho e explique em inglês",
        },
        {
          key: "technical",
          name: "Temas técnicos",
          detail: "12 áreas, de Backend a System Design",
        },
        {
          key: "interview",
          name: "Entrevista",
          detail: "Perguntas e réplicas, por escrito",
        },
      ],
      weak: ["Preposições", "Concordância verbal", "Tempo verbal"],
    },
    // An Exercise in progress, after the Learner's Attempt (screen 4).
    exercise: {
      position: 3,
      total: 8,
      type: "Complete a lacuna",
      instruction: "Complete a frase com a palavra que falta.",
      before: "The release depends",
      after: "the database migration finishing first.",
      answer: "of",
      expected: "on",
      correct: false,
      full: "The release depends on the database migration finishing first.",
      rule: "Em inglês, *depend* pede *on*: *depend on something*. O *of* é o “de” de “depender de”, trazido do português.",
      tip: "Vale também para *dependent on* e *depending on*. O contrário muda: *independent of*.",
      origin: {
        where: "No seu pull request de hoje",
        before: "Before, the profile service ",
        wrong: "depended of",
        right: "depended on",
        after: " the event bus.",
      },
      pattern: {
        from: "depend of",
        to: "depend on",
        category: "Preposições",
        l1: true,
        mastery: "Ativo",
        occurrences: 6,
        recall: 48,
        note: "Uma resposta errada mantém o padrão em Ativo. Duas certas seguidas o levam para Melhorando.",
      },
      history: [
        { when: "hoje", where: "Pull request", text: "depended of the event bus" },
        { when: "há 4 dias", where: "Prompt", text: "it depends of the locale" },
        { when: "há 9 dias", where: "Issue", text: "depending of the plan" },
      ],
      next: "Reescrita",
      queue: ["Múltipla escolha", "Múltipla escolha", "Complete a lacuna", "Reescrita", "Tradução", "Reescrita", "Complete a lacuna", "Múltipla escolha"],
    },
  };
})();
