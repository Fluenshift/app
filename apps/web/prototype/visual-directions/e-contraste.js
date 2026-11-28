// PROTOTYPE (#333), throwaway. Direction E, "Contraste": black on white with signal colors, the way
// a transit map or a road sign works. Each Error Category has its own color and its own shape, so
// a Finding reads at a glance and never by color alone. Thick rules, hard shadows, huge numbers,
// and body text at WCAG AAA (7:1 or more).
(function () {
  const P = window.PROTO;
  const { esc, num, int, rich, segments } = P;

  // Error Category → signal color and shape (ADR 0005 maps the Academy's finer categories here).
  const signals = {
    Preposição: { c: "cyan", s: "circle" },
    "Forma/tempo verbal": { c: "pink", s: "triangle" },
    Artigo: { c: "yellow", s: "square" },
    "Gramática/sintaxe": { c: "lime", s: "diamond" },
    "Escolha de palavra": { c: "orange", s: "plus" },
    "Pontuação/maiúsculas": { c: "lilac", s: "bar" },
    Clareza: { c: "blue", s: "ring" },
    Ortografia: { c: "red", s: "cross" },
  };
  const mistakeToError = {
    "Concordância verbal": "Forma/tempo verbal",
    Preposições: "Preposição",
    Pronomes: "Gramática/sintaxe",
    "Contável/incontável": "Gramática/sintaxe",
  };
  const shapes = {
    circle: '<circle cx="8" cy="8" r="6.2"/>',
    triangle: '<path d="M8 1.6 L15 14.2 H1 Z"/>',
    square: '<rect x="1.8" y="1.8" width="12.4" height="12.4"/>',
    diamond: '<path d="M8 0.8 L15.2 8 L8 15.2 L0.8 8 Z"/>',
    plus: '<path d="M5.8 1h4.4v4.8H15v4.4h-4.8V15H5.8v-4.8H1V5.8h4.8z"/>',
    bar: '<rect x="1" y="4.6" width="14" height="6.8"/>',
    ring: '<circle cx="8" cy="8" r="5.4" class="e-ring"/>',
    cross: '<path d="M3.2 1 L8 5.8 L12.8 1 L15 3.2 L10.2 8 L15 12.8 L12.8 15 L8 10.2 L3.2 15 L1 12.8 L5.8 8 L1 3.2 Z"/>',
  };
  const sigOf = (category) => signals[category] ?? signals[mistakeToError[category]] ?? { c: "white", s: "square" };
  const shape = (category, size = 16) => {
    const g = sigOf(category);
    return `<svg class="e-shape e-fill-${g.c}" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true">${shapes[g.s]}</svg>`;
  };
  // A category chip: color, shape and name together.
  const sig = (category, extra = "") =>
    `<span class="e-sig e-c-${sigOf(category).c} ${extra}">${shape(category)}${esc(category)}</span>`;
  const sevBlocks = (s) =>
    `<span class="e-sev" aria-label="Gravidade ${s.toLowerCase()}"><span aria-hidden="true">${[1, 2, 3].map((n) => `<i class="${n <= P.level(s) ? "is-on" : ""}"></i>`).join("")}</span>${s}</span>`;
  const arrow = (size = 22) =>
    `<svg class="e-arrow" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path d="M3 12h15M12 5l7 7-7 7"/></svg>`;
  const gear = `<svg class="e-gear" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>`;

  const header = (data, ctx) => `
    <header class="e-top">
      <a class="e-logo" href="${ctx.href("desk")}"><span class="e-logo-mark" aria-hidden="true"></span>grifando</a>
      <nav class="e-nav" aria-label="Principal">
        ${data.nav
          .map((item) => {
            const live = ["desk", "progress", "academy"].includes(item.key);
            const on =
              item.key === ctx.screen ||
              (item.key === "academy" && ctx.screen === "practice");
            if (item.key === "settings")
              return `<span class="is-off e-nav-end" title="Fora deste protótipo">${gear}<span class="e-nav-text">${item.label}</span></span>`;
            return live
              ? `<a class="${on ? "is-on" : ""}" href="${ctx.href(item.key)}"${on ? ' aria-current="page"' : ""}>${item.label}</a>`
              : `<span class="is-off" title="Fora deste protótipo">${item.label}</span>`;
          })
          .join("")}
      </nav>
    </header>`;

  const desk = (data, ctx) => {
    const e = data.evaluation;
    const band = P.bandOf(data.bands, e.score);
    const text = segments(e, {
      code: (code) => `<code class="e-code">${esc(code)}</code>`,
      finding: (t, f) =>
        `<mark class="e-mk e-c-${sigOf(f.category).c}" data-link="f${f.n}" tabindex="0"><b class="e-mk-n" aria-label="erro ${f.n}">${f.n}</b>${esc(t)}</mark>`,
      suggestion: (t, s) =>
        `<span class="e-sg" data-link="s${s.n}" tabindex="0"><b class="e-mk-n e-mk-q" aria-label="sugestão">?</b>${esc(t)}</span>`,
    });
    const present = [...new Set(e.findings.map((f) => f.category))];
    // The corrected version, with each Correction marked where it lands.
    let fixed = esc(e.corrected).replace(/`([^`]+)`/g, (_, c) => `<code class="e-code e-code-dark">${c}</code>`);
    for (const f of e.findings)
      fixed = fixed.replace(esc(f.correction), `<mark class="e-fixed">${esc(f.correction)}</mark>`);
    return `
    ${header(data, ctx)}
    <main class="e-wrap">
      <section class="e-compose" aria-labelledby="e-new">
        <div class="e-compose-head">
          <h2 id="e-new" class="e-label">Novo texto</h2>
          <div class="e-kinds" role="radiogroup" aria-label="Tipo de texto">${data.textKinds.map((k) => `<button type="button" role="radio" aria-checked="${k === e.textKind}" class="${k === e.textKind ? "is-on" : ""}">${k}</button>`).join("")}</div>
        </div>
        <label class="sr-only" for="e-input">Texto em inglês</label>
        <textarea id="e-input" rows="3" placeholder="Cole aqui um prompt, uma issue ou a descrição de um pull request…"></textarea>
        <div class="e-compose-foot">
          <label class="e-check"><input type="checkbox"/><span class="e-box" aria-hidden="true"></span><span><b>É treino</b> · não entra no Progresso</span></label>
          <button type="button" class="e-btn e-btn-blue">Avaliar ${arrow(20)}</button>
        </div>
      </section>

      <div class="e-result">
        <article class="e-sheet" aria-labelledby="e-title">
          <p class="e-label">${esc(e.textKind)} · ${esc(e.when)}</p>
          <h1 id="e-title" lang="en">${esc(e.title)}</h1>
          <p class="e-text" lang="en">${text}</p>
          <div class="e-legend" aria-label="Legenda das categorias neste texto">${present.map((c) => sig(c)).join("")}<span class="e-sg-key"><b class="e-mk-n e-mk-q" aria-hidden="true">?</b>Sugestão</span></div>
        </article>
        <aside class="e-side" aria-label="Nota">
          <div class="e-score" role="img" aria-label="Nota ${e.score} de 100, faixa ${e.band}">
            <span class="e-label">Nota</span>
            <b>${e.score}</b>
            <span class="e-score-of">/100</span>
            <span class="e-band">${e.band}</span>
          </div>
          <ol class="e-ruler" aria-label="Faixas da nota">${data.bands.map((b) => `<li class="${b === band ? "is-on" : ""}"><b>${b.name}</b><span>${b.from}–${b.to}</span></li>`).join("")}</ol>
          <dl class="e-facts">
            <div><dt>Erros por 100 palavras</dt><dd>${num(e.findingRate)}</dd></div>
            <div><dt>Palavras em inglês</dt><dd>${e.words}</dd></div>
            <div><dt>Trecho de código fora da avaliação</dt><dd>${e.codeSpans}</dd></div>
            <div><dt>Rubrica</dt><dd>${e.rubric}</dd></div>
          </dl>
        </aside>
      </div>

      <section class="e-findings" aria-labelledby="e-f-title">
        <h2 id="e-f-title" class="e-h2"><span>${e.findings.length}</span> erros</h2>
        <div class="e-cards">
          ${e.findings
            .map(
              (f) => `
          <article class="e-card" data-link="f${f.n}">
            <header class="e-card-head e-c-${sigOf(f.category).c}">${shape(f.category, 18)}<span>${esc(f.category)}</span><b class="e-card-n">${f.n}</b></header>
            <div class="e-card-body">
              <p class="e-change" lang="en"><s>${esc(f.original)}</s>${arrow(20)}<b>${esc(f.correction)}</b></p>
              <p class="e-explain">${rich(f.explanation)}</p>
              <div class="e-card-foot">${sevBlocks(f.severity)}${f.l1 ? `<span class="e-l1">Vem do português</span>` : ""}</div>
            </div>
          </article>`
            )
            .join("")}
          ${e.suggestions
            .map(
              (s) => `
          <article class="e-card e-card-sg" data-link="s${s.n}">
            <header class="e-card-head"><b class="e-mk-n e-mk-q" aria-hidden="true">?</b><span>Sugestão, não é erro</span></header>
            <div class="e-card-body">
              <p class="e-change e-change-sm" lang="en"><span>${esc(s.original)}</span>${arrow(18)}<b>${esc(s.alternative)}</b></p>
              <p class="e-explain">${rich(s.why)}</p>
            </div>
          </article>`
            )
            .join("")}
        </div>
      </section>

      <section class="e-corrected" aria-labelledby="e-corr">
        <div class="e-corrected-head"><h2 id="e-corr" class="e-label">Versão corrigida</h2><button type="button" class="e-btn e-btn-yellow e-btn-sm">Copiar</button></div>
        <p lang="en">${fixed}</p>
      </section>
    </main>`;
  };

  const progress = (data, ctx) => {
    const p = data.progress;
    const kmax = Math.max(...p.byKind.map((k) => k.rate));
    const cmax = Math.max(...p.categories.flatMap((c) => c.series));
    const panels = p.categories
      .map((c) => {
        const { first, last } = P.firstLast(c.series);
        return `<li class="e-panel">
          <header class="e-c-${sigOf(c.name).c}">${shape(c.name, 18)}<span>${esc(c.name)}</span><b>${c.count}</b></header>
          ${P.miniBars(c.series, { width: 240, height: 64, max: cmax, gap: 2.4, days: p.days, className: `e-mb e-mb-${sigOf(c.name).c}` })}
          <p><span>7 primeiros dias <b>${first}</b></span><span>7 últimos <b>${last}</b></span></p>
        </li>`;
      })
      .join("");
    return `
    ${header(data, ctx)}
    <main class="e-wrap">
      <div class="e-page-head">
        <div>
          <p class="e-label">${esc(p.period)} · ${esc(p.seriesStart)} a ${esc(p.seriesEnd)}</p>
          <h1 class="e-giant">Progresso</h1>
          <p class="e-lead">Só textos de trabalho entram aqui. O treino fica de fora.</p>
        </div>
        <div class="e-tools">
          <div class="e-kinds" role="radiogroup" aria-label="Período">${["7 dias", "30 dias", "Tudo"].map((x) => `<button type="button" role="radio" aria-checked="${x === "30 dias"}" class="${x === "30 dias" ? "is-on" : ""}">${x}</button>`).join("")}</div>
          <label class="e-select"><span class="e-label">Tipo de texto</span><select><option>Todos</option>${data.textKinds.map((k) => `<option>${k}</option>`).join("")}</select></label>
        </div>
      </div>
      <section class="e-kpis" aria-label="Resumo do período">
        <div class="e-kpi e-kpi-main"><span class="e-label">Medida principal</span><b>${num(p.findingRate)}</b><span>erros por 100 palavras em inglês</span><em>${p.findings} erros em ${int(p.words)} palavras</em></div>
        <div class="e-kpi"><span class="e-label">Avaliações</span><b>${p.evaluations}</b><span>textos de trabalho</span></div>
        <div class="e-kpi"><span class="e-label">Palavras em inglês</span><b>${int(p.words)}</b><span>avaliadas</span></div>
        <div class="e-kpi"><span class="e-label">Nota média · secundária</span><b>${p.averageScore}</b><span>de 100</span></div>
      </section>
      <section class="e-block" aria-labelledby="e-c1">
        <h2 id="e-c1" class="e-h2">Taxa de erros, dia a dia</h2>
        <p class="e-lead">Erros por 100 palavras em cada dia com avaliações. Faixa listrada: dia sem texto.</p>
        <div class="e-chart">${P.lineChart(p.series, { width: 1180, height: 280, labels: [p.seriesStart, p.seriesEnd], days: p.days, className: "e-lc", dot: 5.5, square: true, emptyBand: true, noArea: true, label: `Taxa de erros por dia. ${P.rateSummary(p)}` })}</div>
        <p class="e-summary">${P.rateSummary(p)}</p>
        <details class="e-data"><summary>Ver os dados em tabela</summary>${P.rateTable(p)}</details>
      </section>
      <section class="e-block" aria-labelledby="e-c2">
        <h2 id="e-c2" class="e-h2">Categorias de erro ao longo do tempo</h2>
        <p class="e-lead">Erros por dia em cada categoria, todos na mesma escala. A cor e o símbolo são os mesmos do texto avaliado.</p>
        <ul class="e-panels">${panels}</ul>
        <details class="e-data"><summary>Ver os dados em tabela</summary>${P.categoryTable(p)}</details>
      </section>
      <div class="e-two">
        <section class="e-block" aria-labelledby="e-c3">
          <h2 id="e-c3" class="e-h2">Por tipo de texto</h2>
          <p class="e-lead">Erros por 100 palavras no período.</p>
          <ul class="e-kbars">${p.byKind.map((k) => `<li><span class="e-kname">${k.kind}</span><span class="e-kbar"><i style="width:${((k.rate / kmax) * 100).toFixed(0)}%"><b>${num(k.rate)}</b></i></span><em>${k.evaluations} avaliações${k.few ? " · poucos dados" : ""}</em></li>`).join("")}</ul>
          <details class="e-data"><summary>Ver os dados em tabela</summary>${P.kindTable(p)}</details>
        </section>
        <section class="e-block" aria-labelledby="e-c4">
          <h2 id="e-c4" class="e-h2">Observações</h2>
          <ol class="e-notes">${p.insights.map((i, n) => `<li><b class="e-note-n" aria-hidden="true">${n + 1}</b><p>${rich(i.text)}</p><a href="#" class="e-more">Ver os erros ${arrow(16)}</a></li>`).join("")}</ol>
        </section>
      </div>
    </main>`;
  };

  const academy = (data, ctx) => {
    const a = data.academy;
    const steps = { Ativo: 1, Melhorando: 2, Dominado: 3 };
    const review = [...a.patterns].sort((x, y) => x.recall - y.recall).slice(0, 3);
    return `
    ${header(data, ctx)}
    <main class="e-wrap">
      <div class="e-page-head">
        <div>
          <p class="e-label">Sexta, 27 de novembro</p>
          <h1 class="e-giant">Treino</h1>
          <p class="e-lead">Exercícios feitos dos seus erros, e um desafio por dia.</p>
        </div>
      </div>
      <div class="e-home">
        <section class="e-go" aria-labelledby="e-go-title">
          <p class="e-label">Exercícios</p>
          <h2 id="e-go-title"><b>${a.exercises.ready}</b> prontos, feitos dos seus erros</h2>
          <div class="e-squares" role="img" aria-label="${a.exercises.done} de ${a.exercises.ready} feitos">${Array.from({ length: a.exercises.ready }, (_, i) => `<i class="${i < a.exercises.done ? "is-done" : ""}"></i>`).join("")}</div>
          <p class="e-go-note">Você já fez ${a.exercises.done}. Próximo: ${esc(a.exercises.next.toLowerCase())}.</p>
          <a class="e-btn e-btn-yellow e-btn-lg" href="${ctx.href("practice")}">Continuar ${arrow(24)}</a>
        </section>
        <section class="e-today" aria-labelledby="e-today-title">
          <p class="e-label">Desafio de hoje · foco em ${esc(a.challenge.focus.toLowerCase())}</p>
          <h2 id="e-today-title" lang="en">${esc(a.challenge.title)}</h2>
          <p lang="en" class="e-prompt">${esc(a.challenge.prompt)}</p>
          <button type="button" class="e-btn e-btn-white">Escrever ${arrow(20)}</button>
        </section>
      </div>
      <section class="e-block" aria-labelledby="e-rev">
        <div class="e-block-head"><h2 id="e-rev" class="e-h2">Para revisar</h2><a class="e-more" href="#">Caderno de erros, ${a.patterns.length} padrões ${arrow(16)}</a></div>
        <ul class="e-review">${review
          .map(
            (p) => `<li>
              ${sig(p.category)}
              <p class="e-review-ex" lang="en"><s>${esc(p.example[0])}</s>${arrow(18)}<b>${esc(p.example[1])}</b></p>
              <span class="e-meta">${p.occurrences} vezes${p.l1 ? " · vem do português" : ""}</span>
              <span class="e-mastery" aria-label="Domínio: ${p.mastery}${p.fading ? ", enfraquecendo" : ""}"><span class="e-steps" aria-hidden="true">${[1, 2, 3].map((n) => `<i class="${n <= steps[p.mastery] ? "is-on" : ""}"></i>`).join("")}</span>${p.mastery}${p.fading ? ", enfraquecendo" : ""}</span>
            </li>`
          )
          .join("")}</ul>
      </section>
      <section class="e-block" aria-labelledby="e-more-title">
        <h2 id="e-more-title" class="e-h2">Mais treinos</h2>
        <div class="e-modes">${a.modes
          .filter((m) => m.key !== "exercises")
          .map((m) => `<a class="e-mode" href="#"><b>${esc(m.name)}</b><span>${esc(m.detail)}</span>${arrow(20)}</a>`)
          .join("")}</div>
      </section>
    </main>`;
  };

  const practice = (data, ctx) => {
    const x = data.exercise;
    const steps = ["Ativo", "Melhorando", "Dominado"];
    return `
    ${header(data, ctx)}
    <main class="e-wrap">
      <div class="e-drill-head">
        <p class="e-label">Treino · exercício ${x.position} de ${x.total} · ${esc(x.type)}</p>
        <ol class="e-squares e-squares-sm" aria-label="Exercícios desta rodada">${Array.from({ length: x.total }, (_, i) => (i < x.position - 1 ? `<li class="is-done" aria-label="${i + 1}: certo">✓</li>` : i === x.position - 1 ? `<li class="is-wrong" aria-label="${i + 1}: errado">✕</li>` : `<li aria-label="${i + 1}: a fazer"></li>`)).join("")}</ol>
      </div>
      <section class="e-ask" aria-labelledby="e-ask-title">
        <h1 id="e-ask-title" class="e-ask-title">${esc(x.instruction)}</h1>
        <p class="e-sentence" lang="en">${esc(x.before)} <span class="e-slot"><span class="e-wrong"><span class="sr-only">Sua resposta:</span>${esc(x.answer)}</span><span class="e-right"><span class="sr-only">Resposta certa:</span>${esc(x.expected)}</span></span> ${esc(x.after)}</p>
      </section>
      <p class="e-verdict" role="status"><span class="e-verdict-x" aria-hidden="true">✕</span><span>Errado. Você escreveu <b lang="en">${esc(x.answer)}</b>; o certo é <b lang="en">${esc(x.expected)}</b>.</span></p>
      <div class="e-why-grid">
        <section class="e-why" aria-labelledby="e-why-title">
          <h2 id="e-why-title" class="e-label">Por quê</h2>
          <p class="e-why-rule">${rich(x.rule)}</p>
          <p>${rich(x.tip)}</p>
          <span class="e-l1">Vem do português</span>
        </section>
        <section class="e-pattern e-c-${sigOf(x.pattern.category).c}" aria-labelledby="e-pat-title">
          <h2 id="e-pat-title" class="e-label">Padrão</h2>
          <p class="e-pattern-ex" lang="en"><s>${esc(x.pattern.from)}</s>${arrow(22)}<b>${esc(x.pattern.to)}</b></p>
          <p class="e-pattern-meta">${shape(x.pattern.category, 18)} ${esc(x.pattern.category)} · ${x.pattern.occurrences} vezes nos seus textos</p>
          <ol class="e-ladder" aria-label="Domínio">${steps.map((s) => `<li class="${s === x.pattern.mastery ? "is-on" : ""}">${s}</li>`).join("")}</ol>
          <p class="e-pattern-note">${esc(x.pattern.note)}</p>
        </section>
      </div>
      <section class="e-origin" aria-labelledby="e-origin-title">
        <h2 id="e-origin-title" class="e-label">${esc(x.origin.where)}</h2>
        <p lang="en">${esc(x.origin.before)}<s>${esc(x.origin.wrong)}</s> <b>${esc(x.origin.right)}</b>${esc(x.origin.after)}</p>
      </section>
      <div class="e-drill-foot"><span class="e-meta">Próximo: ${esc(x.next.toLowerCase())}</span><button type="button" class="e-btn e-btn-blue e-btn-lg">Continuar ${arrow(24)}</button></div>
    </main>`;
  };

  window.VARIANTS.E = {
    name: "Contraste",
    tagline:
      "Preto no branco com cores de sinalização: cada categoria de erro tem cor e símbolo próprios, como numa placa.",
    render: (screen, data, ctx) =>
      ({ desk, progress, academy, practice })[screen](data, ctx),
  };
})();
