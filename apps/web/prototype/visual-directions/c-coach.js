// PROTOTYPE (#333), throwaway. Direction C, "Coach": a bright, friendly consumer product. One thing
// at a time, big type, rounded cards, plain words, and a coach who talks in short sentences. No
// game elements: no streak, points or badges (ADR 0046).
(function () {
  const P = window.PROTO;
  const { esc, num, int, rich, segments } = P;

  const kindIcon = {
    Prompt: '<path d="M5 6h14v9H9l-4 3V6z"/><path d="M9 10h6"/>',
    Issue:
      '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
    "Pull request":
      '<circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M7 8v8"/><path d="M17 16V9a3 3 0 0 0-3-3h-3"/>',
    Outro: '<path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h6"/>',
  };
  const modeIcon = {
    explain: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/>',
    technical:
      '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    interview: '<path d="M4 5h16v10H8l-4 4V5z"/>',
  };
  const gear =
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>';
  const svg = (paths, size = 22) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const icon = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cross: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  };

  // The coach: a round face that speaks the summary lines. A face, not a game element.
  const coach = (size = 44) =>
    `<span class="c-coach" style="--s:${size}px" aria-hidden="true"><i></i><i></i></span>`;
  const say = (html, extra = "") =>
    `<div class="c-say ${extra}">${coach()}<div class="c-bubble">${html}</div></div>`;

  const header = (data, ctx) => `
    <header class="c-top">
      <a class="c-logo" href="${ctx.href("desk")}">${coach(30)}grifando</a>
      <nav class="c-nav" aria-label="Principal">
        ${data.nav
          .map((item) => {
            const live = ["desk", "progress", "academy"].includes(item.key);
            const on =
              item.key === ctx.screen ||
              (item.key === "academy" && ctx.screen === "practice");
            if (item.key === "settings")
              return `<span class="is-off c-nav-settings" title="Fora deste protótipo">${svg(gear, 18)}<span class="c-nav-text">${item.label}</span></span>`;
            return live
              ? `<a class="${on ? "is-on" : ""}" href="${ctx.href(item.key)}"${on ? ' aria-current="page"' : ""}>${item.label}</a>`
              : `<span class="is-off" title="Fora deste protótipo">${item.label}</span>`;
          })
          .join("")}
      </nav>
    </header>`;

  const chip = (text, cls = "") => `<span class="c-chip ${cls}">${text}</span>`;
  const sevChip = (s) =>
    chip(
      `<span class="c-dots-sev" aria-hidden="true">${[1, 2, 3].map((n) => `<i class="${n <= P.level(s) ? "is-on" : ""}"></i>`).join("")}</span>${s}`,
      `c-sev-${s.toLowerCase()}`
    );

  const desk = (data, ctx) => {
    const e = data.evaluation;
    const focus = e.findings[2];
    const text = segments(e, {
      code: (code) => `<code class="c-code">${esc(code)}</code>`,
      finding: (t, f) =>
        `<span class="c-mark${f.n === focus.n ? " is-focus" : ""}" data-link="f${f.n}" tabindex="0">${esc(t)}<b aria-label="erro ${f.n}">${f.n}</b></span>`,
      suggestion: (t, s) =>
        `<span class="c-mark c-mark-idea" data-link="s${s.n}" tabindex="0">${esc(t)}<b aria-label="sugestão">?</b></span>`,
    });
    const band = P.bandOf(data.bands, e.score);
    return `
    ${header(data, ctx)}
    <main class="c-wrap">
      <section class="c-hero">
        <h1>Confira seu inglês</h1>
        <p>Cole algo que você escreveu no trabalho. O Grifando avalia só o inglês, nunca o código.</p>
      </section>
      <section class="c-card c-compose" aria-label="Novo texto">
        <div class="c-kinds" role="radiogroup" aria-label="Tipo de texto">
          ${data.textKinds
            .map(
              (k) =>
                `<button type="button" role="radio" aria-checked="${k === e.textKind}" class="c-kind${k === e.textKind ? " is-on" : ""}">${svg(kindIcon[k])}<span>${k}</span></button>`
            )
            .join("")}
        </div>
        <label class="sr-only" for="c-input">Texto em inglês</label>
        <textarea id="c-input" rows="4" placeholder="Cole seu texto aqui…"></textarea>
        <div class="c-compose-row">
          <label class="c-toggle"><input type="checkbox" class="c-switch-input"/><span class="c-switch" aria-hidden="true"></span><span>É só treino <em>(não entra no Progresso)</em></span></label>
          <button type="button" class="c-btn">Avaliar meu texto</button>
        </div>
      </section>

      <section class="c-card c-result" aria-labelledby="c-result-title">
        <div class="c-score" role="img" aria-label="Nota ${e.score} de 100, faixa ${e.band}">
          ${P.ring(e.score, 140, 14)}
          <div class="c-score-num"><b>${e.score}</b><span>${e.band}</span></div>
        </div>
        <div class="c-result-text">
          <div class="c-chip-row">${chip(esc(e.textKind))}${chip(`${e.words} palavras`)}${chip(`${num(e.findingRate)} erros por 100 palavras`)}</div>
          <h2 id="c-result-title">Texto claro, com ${e.findings.length} erros para corrigir</h2>
          ${say(`Seu leitor entende a mensagem. Corrija os ${e.findings.length} erros e o texto fica natural. Tem também 1 sugestão, se você quiser.`)}
          <ol class="c-bandbar" aria-label="Faixas da nota">${data.bands.map((b) => `<li class="${b === band ? "is-on" : ""}"><b>${b.name}</b><span>${b.from}–${b.to}</span></li>`).join("")}</ol>
        </div>
      </section>

      <section class="c-card c-text-card" aria-label="Seu texto">
        <p class="c-text" lang="en">${text}</p>
      </section>

      <section class="c-step" aria-labelledby="c-step-title">
        <div class="c-step-head">
          <h2 id="c-step-title">Vamos corrigir, um por um</h2>
          <div class="c-pager"><button type="button" class="c-round" aria-label="Erro anterior">${svg(icon.back, 18)}</button><span>Erro <b>${focus.n}</b> de ${e.findings.length}</span><button type="button" class="c-round" aria-label="Próximo erro">${svg(icon.arrow, 18)}</button></div>
        </div>
        <article class="c-card c-focus" data-link="f${focus.n}">
          <div class="c-fix-num">${focus.n}</div>
          <div class="c-fix-body">
            <div class="c-fix-change" lang="en"><span class="c-old">${esc(focus.original)}</span><span class="c-arrow" aria-hidden="true">${svg(icon.arrow, 22)}</span><span class="c-new">${esc(focus.correction)}</span></div>
            <p class="c-explain">${rich(focus.explanation)}</p>
            <div class="c-chip-row">${chip(esc(focus.category))}${sevChip(focus.severity)}${focus.l1 ? chip("Vem do português", "c-chip-pt") : ""}</div>
            <div class="c-focus-actions"><button type="button" class="c-btn">Entendi, próximo</button><a class="c-btn c-btn-soft" href="${ctx.href("practice")}">Treinar este padrão</a></div>
          </div>
        </article>
        <ol class="c-list" aria-label="Todos os erros">
          ${e.findings
            .map(
              (f) => `<li class="${f.n === focus.n ? "is-on" : f.n < focus.n ? "is-seen" : ""}" data-link="f${f.n}">
                <span class="c-list-num">${f.n < focus.n ? `<span class="sr-only">visto</span>${svg(icon.check, 16)}` : f.n}</span>
                <span class="c-list-change" lang="en"><s>${esc(f.original)}</s> → <b>${esc(f.correction)}</b></span>
                <span class="c-list-cat">${esc(f.category)}${f.l1 ? " · vem do português" : ""}</span>
              </li>`
            )
            .join("")}
        </ol>
      </section>

      ${e.suggestions
        .map(
          (s) => `
      <section class="c-card c-idea" aria-labelledby="c-idea-title" data-link="s${s.n}">
        <div class="c-fix-num">?</div>
        <div class="c-fix-body">
          <h2 id="c-idea-title" class="c-eyebrow c-eyebrow-sky">Uma ideia opcional</h2>
          <div class="c-fix-change c-fix-change-sm" lang="en"><span>${esc(s.original)}</span><span class="c-arrow" aria-hidden="true">${svg(icon.arrow, 18)}</span><span class="c-new c-new-idea">${esc(s.alternative)}</span></div>
          <p class="c-explain">${rich(s.why)}</p>
          <div class="c-chip-row">${chip("Sugestão, não é erro", "c-chip-idea")}</div>
        </div>
      </section>`
        )
        .join("")}

      <section class="c-card c-corrected" aria-labelledby="c-corr-title">
        <div class="c-corrected-head"><h2 id="c-corr-title">Versão corrigida</h2><button type="button" class="c-btn c-btn-soft c-btn-sm">${svg(icon.copy, 16)} Copiar</button></div>
        <p lang="en">${P.corrected(e.corrected, (c) => `<code class="c-code">${esc(c)}</code>`)}</p>
      </section>
    </main>`;
  };

  const progress = (data, ctx) => {
    const p = data.progress;
    const kmax = Math.max(...p.byKind.map((k) => k.rate));
    const cmax = Math.max(...p.categories.flatMap((c) => c.series));
    const strips = p.categories
      .map((c) => {
        const { first, last } = P.firstLast(c.series);
        const dots = c.series
          .map((v, i) =>
            v === null
              ? `<i class="c-dot is-empty" title="${p.days[i]}: sem avaliação"></i>`
              : `<i class="c-dot" style="--d:${v === 0 ? 0 : 6 + (v / cmax) * 12}px" title="${p.days[i]}: ${v} ${v === 1 ? "erro" : "erros"}"></i>`
          )
          .join("");
        return `<li><span class="c-strip-name">${esc(c.name)}</span><span class="c-strip" aria-hidden="true">${dots}</span><b>${c.count}</b><em>${first} → ${last}</em></li>`;
      })
      .join("");
    return `
    ${header(data, ctx)}
    <main class="c-wrap c-wrap-wide">
      <section class="c-hero c-hero-row">
        <div><h1>Seu inglês nos últimos 30 dias</h1><p>Só textos de trabalho contam aqui. O treino fica de fora.</p></div>
        <div class="c-filters">
          <div class="c-seg" role="radiogroup" aria-label="Período">${["7 dias", "30 dias", "Tudo"].map((x) => `<button type="button" role="radio" aria-checked="${x === "30 dias"}" class="${x === "30 dias" ? "is-on" : ""}">${x}</button>`).join("")}</div>
          <div class="c-seg c-seg-light" role="radiogroup" aria-label="Tipo de texto">${["Todos", ...data.textKinds].map((x) => `<button type="button" role="radio" aria-checked="${x === "Todos"}" class="${x === "Todos" ? "is-on" : ""}">${x}</button>`).join("")}</div>
        </div>
      </section>
      <section class="c-stats" aria-label="Resumo do período">
        <div class="c-stat c-stat-main"><b>${num(p.findingRate)}</b><span>erros por 100 palavras</span><em>A medida que mais importa: ${p.findings} erros em ${int(p.words)} palavras.</em></div>
        <div class="c-stat"><b>${p.evaluations}</b><span>textos avaliados</span></div>
        <div class="c-stat"><b>${int(p.words)}</b><span>palavras em inglês</span></div>
        <div class="c-stat"><b>${p.averageScore}</b><span>nota média</span><em class="c-muted-em">secundária</em></div>
      </section>
      <section class="c-card c-chart" aria-labelledby="c-c1">
        <h2 id="c-c1">Dia a dia</h2>
        <p class="c-muted">Erros por 100 palavras em cada dia em que você escreveu. A linha pontilhada atravessa os dias sem texto.</p>
        ${P.lineChart(p.series, { width: 1000, height: 250, labels: [p.seriesStart, p.seriesEnd], days: p.days, className: "c-lc", dot: 5.5, label: `Taxa de erros por dia. ${P.rateSummary(p)}` })}
        ${say(esc(P.rateSummary(p)), "c-say-sm")}
        <details class="c-data"><summary>Ver os números</summary>${P.rateTable(p)}</details>
      </section>
      <div class="c-grid2">
        <section class="c-card" aria-labelledby="c-c2">
          <h2 id="c-c2">Erros por categoria, dia a dia</h2>
          <p class="c-muted">Quanto maior a bolinha, mais erros naquele dia. No fim: o total, e os 7 primeiros dias → os 7 últimos.</p>
          <ul class="c-strips">${strips}</ul>
          <details class="c-data"><summary>Ver os números</summary>${P.categoryTable(p)}</details>
        </section>
        <section class="c-card" aria-labelledby="c-c3">
          <h2 id="c-c3">Por tipo de texto</h2>
          <p class="c-muted">Erros por 100 palavras.</p>
          <div class="c-kinds-cmp">${p.byKind
            .map(
              (k) =>
                `<div class="c-kind-cmp">${svg(kindIcon[k.kind], 20)}<span>${k.kind}</span><div class="c-mini" aria-hidden="true"><i style="height:${((k.rate / kmax) * 100).toFixed(0)}%"></i></div><b>${num(k.rate)}</b><em>${k.evaluations} textos${k.few ? "<br/>poucos dados" : ""}</em></div>`
            )
            .join("")}</div>
          <details class="c-data"><summary>Ver os números</summary>${P.kindTable(p)}</details>
        </section>
      </div>
      <section class="c-card c-insights" aria-labelledby="c-c4">
        <h2 id="c-c4">Observações</h2>
        <div class="c-notes">${p.insights.map((i) => `<p class="c-note">${rich(i.text)} <a href="#">Mostrar os erros</a></p>`).join("")}</div>
      </section>
    </main>`;
  };

  const academy = (data, ctx) => {
    const a = data.academy;
    const steps = { Ativo: 1, Melhorando: 2, Dominado: 3 };
    const review = [...a.patterns].sort((x, y) => x.recall - y.recall).slice(0, 3);
    return `
    ${header(data, ctx)}
    <main class="c-wrap">
      <section class="c-card c-today" aria-labelledby="c-today-title">
        <p class="c-eyebrow">Treino de hoje</p>
        <h1 id="c-today-title">${a.exercises.ready} exercícios feitos dos seus erros</h1>
        ${say(`Separei exercícios dos erros que você mais repete. Você já fez ${a.exercises.done} de ${a.exercises.ready}. Leva uns 5 minutos.`)}
        <div class="c-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${a.exercises.ready}" aria-valuenow="${a.exercises.done}" aria-label="Exercícios feitos"><i style="width:${(a.exercises.done / a.exercises.ready) * 100}%"></i></div>
        <div class="c-today-foot"><span class="c-muted">${a.exercises.done} de ${a.exercises.ready} feitos</span><a class="c-btn c-btn-lg" href="${ctx.href("practice")}">Continuar ${svg(icon.arrow, 20)}</a></div>
      </section>

      <section class="c-card c-challenge" aria-labelledby="c-ch-title">
        <div>
          <p class="c-eyebrow c-eyebrow-coral">Desafio de hoje · foco em ${esc(a.challenge.focus.toLowerCase())}</p>
          <h2 id="c-ch-title" lang="en">${esc(a.challenge.title)}</h2>
          <p lang="en" class="c-prompt">${esc(a.challenge.prompt)}</p>
        </div>
        <button type="button" class="c-btn c-btn-soft">Escrever</button>
      </section>

      <section class="c-card c-patterns" aria-labelledby="c-pat-title">
        <h2 id="c-pat-title">Padrões que você está treinando</h2>
        <p class="c-muted">Cada padrão aparece uma vez aqui, por mais que o erro se repita.</p>
        <ul>${review
          .map(
            (p) => `<li>
              <div class="c-meter" role="img" aria-label="Domínio: ${p.mastery}">${[1, 2, 3].map((n) => `<i class="${n <= steps[p.mastery] ? "is-on" : ""}"></i>`).join("")}</div>
              <div><div class="c-pat" lang="en"><span class="c-old">${esc(p.example[0])}</span> → <span class="c-new">${esc(p.example[1])}</span></div>
              <div class="c-muted c-small">${esc(p.category)} · ${p.occurrences} vezes${p.l1 ? " · vem do português" : ""}</div></div>
              <span class="c-badge c-badge-${p.mastery.toLowerCase()}">${p.mastery}${p.fading ? ", enfraquecendo" : ""}</span>
            </li>`
          )
          .join("")}</ul>
        <a class="c-link" href="#">Ver os ${a.patterns.length} no caderno de erros</a>
      </section>

      <section class="c-more" aria-labelledby="c-more-title">
        <h2 id="c-more-title">Mais jeitos de treinar</h2>
        <div class="c-more-row">${a.modes
          .filter((m) => m.key !== "exercises")
          .map((m) => `<a class="c-pill" href="#"><span class="c-pill-icon">${svg(modeIcon[m.key], 20)}</span><span><b>${esc(m.name)}</b><em>${esc(m.detail)}</em></span></a>`)
          .join("")}</div>
      </section>
    </main>`;
  };

  const practice = (data, ctx) => {
    const x = data.exercise;
    return `
    ${header(data, ctx)}
    <main class="c-wrap c-lesson">
      <div class="c-lesson-top">
        <a class="c-round" href="${ctx.href("academy")}" aria-label="Sair do treino">${svg(icon.cross, 18)}</a>
        <div class="c-progress c-progress-lesson" role="progressbar" aria-valuemin="0" aria-valuemax="${x.total}" aria-valuenow="${x.position}" aria-label="Exercício ${x.position} de ${x.total}"><i style="width:${(x.position / x.total) * 100}%"></i></div>
        <span class="c-muted">${x.position} de ${x.total}</span>
      </div>
      <section class="c-card c-ask" aria-labelledby="c-ask-title">
        <p class="c-eyebrow">${esc(x.type)}</p>
        <h1 id="c-ask-title">${esc(x.instruction)}</h1>
        <p class="c-sentence" lang="en">${esc(x.before)} <span class="c-answer is-wrong"><span class="sr-only">Sua resposta, errada:</span>${svg(icon.cross, 18)}<s>${esc(x.answer)}</s></span> ${esc(x.after)}</p>
      </section>
      <section class="c-feedback" role="status" aria-labelledby="c-fb-title">
        <div class="c-fb-head">
          <span class="c-fb-icon" aria-hidden="true">${svg(icon.cross, 26)}</span>
          <div>
            <h2 id="c-fb-title">Quase! A resposta certa é <span lang="en" class="c-right">${esc(x.expected)}</span>.</h2>
            <p class="c-fb-full" lang="en">${esc(x.before)} <b>${esc(x.expected)}</b> ${esc(x.after)}</p>
          </div>
        </div>
        ${say(`<p>${rich(x.rule)}</p><p>${rich(x.tip)}</p><div class="c-chip-row">${chip("Vem do português", "c-chip-pt")}${chip(esc(x.pattern.category))}</div>`)}
        <div class="c-origin">
          <p class="c-eyebrow c-eyebrow-coral">${esc(x.origin.where)}</p>
          <p lang="en">${esc(x.origin.before)}<span class="c-old">${esc(x.origin.wrong)}</span> → <span class="c-new">${esc(x.origin.right)}</span>${esc(x.origin.after)}</p>
        </div>
        <div class="c-fb-foot">
          <p class="c-muted c-small"><span lang="en" class="c-pat-inline">${esc(x.pattern.from)} → ${esc(x.pattern.to)}</span> continua <b>${x.pattern.mastery}</b>. ${esc(x.pattern.note.split(". ")[1])}</p>
          <button type="button" class="c-btn c-btn-lg">Continuar</button>
        </div>
      </section>
    </main>`;
  };

  window.VARIANTS.C = {
    name: "Coach",
    tagline:
      "Um treinador simpático que fala português: uma coisa de cada vez, letra grande, frases curtas.",
    render: (screen, data, ctx) =>
      ({ desk, progress, academy, practice })[screen](data, ctx),
  };
})();
