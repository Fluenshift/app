// PROTOTYPE (#333), throwaway. Direction D, "Console": a calm, dense work tool in the style of
// modern SaaS apps. A sidebar, an editor beside an inspector, tables for the numbers, and the
// keyboard everywhere. Severity is the underline's style (dotted, wavy, double), not only a color.
(function () {
  const P = window.PROTO;
  const { esc, num, int, rich, segments } = P;

  const paths = {
    desk: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    history: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    progress: '<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/>',
    academy: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
    trash: '<path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V4h6v3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    cross: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2"/>',
    code: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/>',
  };
  const svg = (name, size = 16) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  const counts = { history: "43", academy: "8" };
  // Severity as a small meter of 1 to 3 bars, so it never relies on color.
  const sevMeter = (s) =>
    `<span class="d-sev d-sev-${s.toLowerCase()}" role="img" aria-label="Gravidade ${s.toLowerCase()}">${[1, 2, 3].map((n) => `<i class="${n <= P.level(s) ? "is-on" : ""}"></i>`).join("")}</span>`;

  const shell = (data, ctx, crumbs, actions, body) => `
    <div class="d-app">
      <aside class="d-side">
        <div class="d-ws"><span class="d-logo">G</span><b>Grifando</b><button type="button" class="d-icon" aria-label="Buscar">${svg("search")}</button></div>
        <button type="button" class="d-newbtn">${svg("plus")}<span>Novo texto</span><kbd>N</kbd></button>
        <nav class="d-nav" aria-label="Principal">
          ${data.nav
            .filter((i) => i.key !== "settings")
            .map((item) => {
              const live = ["desk", "progress", "academy"].includes(item.key);
              const on =
                item.key === ctx.screen ||
                (item.key === "academy" && ctx.screen === "practice");
              const count = counts[item.key]
                ? `<em>${counts[item.key]}</em>`
                : "";
              return live
                ? `<a class="${on ? "is-on" : ""}" href="${ctx.href(item.key)}"${on ? ' aria-current="page"' : ""}>${svg(item.key)}<span>${item.label}</span>${count}</a>`
                : `<span class="is-off" title="Fora deste protótipo">${svg(item.key)}<span>${item.label}</span>${count}</span>`;
            })
            .join("")}
        </nav>
        <div class="d-side-label">Recentes</div>
        <ul class="d-recent">${data.history
          .slice(0, 5)
          .map(
            (h) =>
              `<li><span class="d-recent-title" lang="en">${esc(h.title)}</span><span class="d-score-chip" title="${h.band}">${h.score}</span></li>`
          )
          .join("")}</ul>
        <div class="d-side-foot">
          <span class="is-off" title="Fora deste protótipo">${svg("settings")}<span>Configurações</span></span>
          <div class="d-key">${svg("key", 14)}<span>Chave OpenRouter</span><b>ativa</b></div>
        </div>
      </aside>
      <div class="d-main">
        <header class="d-bar">
          <button type="button" class="d-icon d-menu" aria-label="Menu">${svg("menu", 18)}</button>
          <div class="d-crumbs">${crumbs}</div>
          <button type="button" class="d-cmd">${svg("search", 14)}<span>Buscar ou executar…</span><kbd>⌘K</kbd></button>
          <div class="d-actions">${actions}</div>
        </header>
        ${body}
      </div>
    </div>`;

  const desk = (data, ctx) => {
    const e = data.evaluation;
    const sel = 3;
    const text = segments(e, {
      code: (code) => `<code class="d-code">${esc(code)}</code>`,
      finding: (t, f) =>
        `<span class="d-mk d-mk-${f.severity.toLowerCase()}${f.n === sel ? " is-sel" : ""}" data-link="f${f.n}" tabindex="0">${esc(t)}<sup>${f.n}</sup></span>`,
      suggestion: (t, s) =>
        `<span class="d-mk d-mk-idea" data-link="s${s.n}" tabindex="0">${esc(t)}<sup>s</sup></span>`,
    });
    const band = P.bandOf(data.bands, e.score);
    const body = `
      <div class="d-desk">
        <section class="d-editor" aria-labelledby="d-title">
          <div class="d-editor-top">
            <div class="d-seg" role="radiogroup" aria-label="Tipo de texto">${data.textKinds.map((k) => `<button type="button" role="radio" aria-checked="${k === e.textKind}" class="${k === e.textKind ? "is-on" : ""}">${k}</button>`).join("")}</div>
            <label class="d-check"><input type="checkbox"/> Marcar como treino <span>não conta no Progresso</span></label>
          </div>
          <h1 id="d-title" lang="en">${esc(e.title)}</h1>
          <div class="d-sub"><span>${esc(e.when)}</span><span>${e.words} palavras em inglês</span><span>${e.codeSpans} trecho de código fora da avaliação</span><span>Rubrica ${e.rubric}</span></div>
          <p class="d-text" lang="en">${text}</p>
          <p class="d-legend" aria-label="Legenda dos sublinhados"><span><i class="d-lg d-lg-leve"></i>leve</span><span><i class="d-lg d-lg-moderada"></i>moderada</span><span><i class="d-lg d-lg-grave"></i>grave</span><span><i class="d-lg d-lg-idea"></i>sugestão</span><span class="d-legend-keys"><kbd>J</kbd><kbd>K</kbd> navegar entre erros</span></p>
          <div class="d-compose"><label class="sr-only" for="d-input">Texto em inglês</label><textarea id="d-input" rows="2" placeholder="Cole um texto novo para avaliar…"></textarea><button type="button" class="d-primary">Avaliar <kbd>⌘↵</kbd></button></div>
        </section>
        <aside class="d-inspector" aria-label="Avaliação">
          <div class="d-scorecard">
            <div><div class="d-label">Nota</div><div class="d-score"><b>${e.score}</b><span class="d-band">${e.band}</span></div></div>
            <div><div class="d-label">Taxa de erros</div><div class="d-rate"><b>${num(e.findingRate)}</b><span>por 100 palavras</span></div></div>
          </div>
          <div class="d-scale" role="img" aria-label="Nota ${e.score}: faixa ${band.name}, de ${band.from} a ${band.to}">
            <div class="d-scale-bar">${data.bands.map((b) => `<span class="${b === band ? "is-on" : ""}" style="flex:${b.to - b.from + 1}"></span>`).join("")}<i style="left:${e.score}%"></i></div>
            <div class="d-scale-ticks"><span>0</span><span style="left:50%">50</span><span style="left:70%">70</span><span style="left:85%">85</span><span style="left:100%">100</span></div>
            <p class="d-scale-names">${data.bands.map((b) => (b === band ? `<b>${b.name}</b>` : b.name)).join(" · ")}</p>
          </div>
          <div class="d-tabs" role="tablist"><span role="tab" aria-selected="true" class="is-on">Erros <em>${e.findings.length}</em></span><span role="tab" aria-selected="false">Sugestões <em>${e.suggestions.length}</em></span><span role="tab" aria-selected="false">Versão corrigida</span></div>
          <ul class="d-findings">
            ${e.findings
              .map(
                (f) => `<li class="${f.n === sel ? "is-open" : ""}" data-link="f${f.n}">
                  <div class="d-frow"><span class="d-fnum">${f.n}</span>${sevMeter(f.severity)}<code class="d-old" lang="en">${esc(f.original)}</code><span class="d-to" aria-hidden="true">→</span><code class="d-new" lang="en">${esc(f.correction)}</code><span class="d-cat">${esc(f.category)}</span></div>
                  ${
                    f.n === sel
                      ? `<p>${rich(f.explanation)}</p>
                  <div class="d-tags"><span>${f.severity}</span>${f.l1 ? "<span>Vem do português</span>" : ""}<span>Padrão <code lang="en">depend of → depend on</code> · Ativo</span></div>
                  <div class="d-row-actions"><a class="d-ghost" href="${ctx.href("practice")}">Treinar o padrão <kbd>T</kbd></a><button type="button" class="d-ghost">Copiar correção <kbd>C</kbd></button></div>`
                      : ""
                  }
                </li>`
              )
              .join("")}
          </ul>
        </aside>
      </div>`;
    return shell(
      data,
      ctx,
      `<span>Escrever</span><i>/</i><b lang="en">${esc(e.title)}</b>`,
      `<button type="button" class="d-ghost">${svg("copy", 14)}<span>Copiar versão corrigida</span></button><button type="button" class="d-ghost d-ghost-icon" aria-label="Excluir avaliação">${svg("trash", 14)}</button>`,
      body
    );
  };

  const progress = (data, ctx) => {
    const p = data.progress;
    const kmax = Math.max(...p.byKind.map((k) => k.rate));
    const cmax = Math.max(...p.categories.flatMap((c) => c.series));
    const spark = P.lineChart(p.series, {
      width: 180,
      height: 44,
      pad: { top: 4, right: 2, bottom: 4, left: 2 },
      ticks: [],
      dot: 0,
      className: "d-spark",
      label: "Tendência da taxa de erros",
    });
    const dayNums = p.days.map((d) => d.split(" ")[0]);
    const heat = `
      <table class="d-heat">
        <caption class="sr-only">Erros por categoria em cada dia, de ${p.seriesStart} a ${p.seriesEnd}. Dias sem avaliação aparecem vazios.</caption>
        <thead><tr><th scope="col">Categoria</th>${dayNums.map((d, i) => `<th scope="col" class="${p.series[i] === null ? "is-gap" : ""}" title="${p.days[i]}">${d}</th>`).join("")}<th scope="col" class="d-heat-total">Total</th><th scope="col" class="d-heat-total">%</th></tr></thead>
        <tbody>${p.categories
          .map(
            (c) =>
              `<tr><th scope="row">${esc(c.name)}</th>${c.series
                .map((v, i) =>
                  v === null
                    ? `<td class="is-gap"><span class="sr-only">sem avaliação</span></td>`
                    : `<td style="--a:${(v / cmax).toFixed(2)}" class="${v === 0 ? "is-zero" : v / cmax > 0.6 ? "is-hot" : ""}" title="${p.days[i]}: ${v}">${v}</td>`
                )
                .join("")}<td class="d-heat-total">${c.count}</td><td class="d-heat-total">${Math.round((c.count / p.findings) * 100)}%</td></tr>`
          )
          .join("")}</tbody>
      </table>`;
    const body = `
      <div class="d-page">
        <div class="d-page-head">
          <div><h1>Progresso</h1><p class="d-p">Só avaliações de textos de trabalho. O treino fica de fora.</p></div>
          <div class="d-filters"><div class="d-seg" role="radiogroup" aria-label="Período">${["7 dias", "30 dias", "Tudo"].map((x) => `<button type="button" role="radio" aria-checked="${x === "30 dias"}" class="${x === "30 dias" ? "is-on" : ""}">${x}</button>`).join("")}</div><button type="button" class="d-ghost">Tipo de texto: Todos ▾</button><span class="d-pill d-pill-muted">Rubrica ${esc(data.evaluation.rubric)}</span></div>
        </div>
        <div class="d-kpis">
          <div class="d-kpi d-kpi-main"><div class="d-label">Taxa de erros <span class="d-pill">Principal</span></div><b>${num(p.findingRate)}</b><span>erros por 100 palavras · ${p.findings} em ${int(p.words)}</span>${spark}</div>
          <div class="d-kpi"><div class="d-label">Avaliações</div><b>${p.evaluations}</b><span>textos de trabalho</span></div>
          <div class="d-kpi"><div class="d-label">Palavras em inglês</div><b>${int(p.words)}</b><span>avaliadas</span></div>
          <div class="d-kpi"><div class="d-label">Nota média <span class="d-pill d-pill-muted">Secundária</span></div><b>${p.averageScore}</b><span>de 100</span></div>
        </div>
        <section class="d-card" aria-labelledby="d-c1">
          <div class="d-card-head"><b id="d-c1">Taxa de erros por dia</b><span>${esc(P.rateSummary(p))}</span></div>
          ${P.lineChart(p.series, { width: 1100, height: 230, labels: [p.seriesStart, p.seriesEnd], days: p.days, className: "d-lc", emptyBand: true, label: `Taxa de erros por dia. ${P.rateSummary(p)}` })}
          <div class="d-card-foot"><span><i class="d-key-band"></i>dia sem avaliação</span><details class="d-data"><summary>Tabela</summary>${P.rateTable(p)}</details></div>
        </section>
        <section class="d-card" aria-labelledby="d-c2">
          <div class="d-card-head"><b id="d-c2">Categorias de erro por dia</b><span>erros em cada dia · ${p.findings} no período · colunas vazias são dias sem avaliação</span></div>
          <div class="d-heat-wrap">${heat}</div>
        </section>
        <div class="d-grid">
          <section class="d-card" aria-labelledby="d-c3">
            <div class="d-card-head"><b id="d-c3">Por tipo de texto</b><span>erros por 100 palavras</span></div>
            <ul class="d-kbars">${p.byKind.map((k) => `<li><span>${k.kind}</span><span class="d-kbar" aria-hidden="true"><i style="width:${((k.rate / kmax) * 100).toFixed(0)}%"></i></span><b>${num(k.rate)}</b><em>${k.evaluations} aval.${k.few ? " · poucos dados" : ""}</em></li>`).join("")}</ul>
            <details class="d-data"><summary>Tabela</summary>${P.kindTable(p)}</details>
          </section>
          <section class="d-card" aria-labelledby="d-c4">
            <div class="d-card-head"><b id="d-c4">Observações</b><span>cada uma abre os seus erros</span></div>
            <ul class="d-insights">${p.insights.map((i) => `<li><span>${rich(i.text)}</span><button type="button" class="d-ghost d-xs">Evidências</button></li>`).join("")}</ul>
          </section>
        </div>
      </div>`;
    return shell(
      data,
      ctx,
      `<b>Progresso</b>`,
      `<button type="button" class="d-ghost">Ajuda</button>`,
      body
    );
  };

  const academy = (data, ctx) => {
    const a = data.academy;
    const queue = [...a.patterns].sort((x, y) => x.recall - y.recall);
    const body = `
      <div class="d-page">
        <div class="d-page-head">
          <div><h1>Treino</h1><p class="d-p">Exercícios feitos dos seus erros. Os padrões com menor fixação vêm primeiro.</p></div>
        </div>
        <nav class="d-subnav" aria-label="Treino">${["Visão geral", "Exercícios", "Caderno de erros", "Explicar código", "Temas técnicos", "Entrevista"].map((t, i) => `<a href="#" class="${i === 0 ? "is-on" : ""}"${i === 0 ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
        <div class="d-acad">
          <section class="d-card" aria-labelledby="d-q">
            <div class="d-card-head"><b id="d-q">Fila de revisão</b><a class="d-primary" href="${ctx.href("practice")}">Praticar ${a.exercises.ready - a.exercises.done} restantes <kbd>↵</kbd></a></div>
            <table class="d-table d-queue">
              <thead><tr><th scope="col">Padrão</th><th scope="col">Categoria</th><th scope="col" class="num">Vezes</th><th scope="col">Domínio</th><th scope="col">Fixação</th></tr></thead>
              <tbody>${queue
                .map(
                  (p) =>
                    `<tr><td lang="en"><code class="d-old">${esc(p.example[0])}</code> <span class="d-to" aria-hidden="true">→</span> <code class="d-new">${esc(p.example[1])}</code></td><td>${esc(p.category)}${p.l1 ? ' <span class="d-pill d-pill-muted">PT</span>' : ""}</td><td class="num">${p.occurrences}</td><td><span class="d-status d-st-${p.mastery.toLowerCase()}${p.fading ? " is-fading" : ""}">${p.mastery}${p.fading ? " · enfraquecendo" : ""}</span></td><td><span class="d-recall" aria-hidden="true"><i style="width:${p.recall}%"></i></span> ${p.recall}%</td></tr>`
                )
                .join("")}</tbody>
            </table>
            <p class="d-foot-note">PT: vem do português. Fixação: a chance estimada de você ainda acertar o padrão hoje.</p>
          </section>
          <div class="d-stack">
            <section class="d-card d-session" aria-labelledby="d-s">
              <div class="d-card-head"><b id="d-s">Sessão de hoje</b><span>${a.exercises.done} de ${a.exercises.ready}</span></div>
              <div class="d-segments" aria-hidden="true">${Array.from({ length: a.exercises.ready }, (_, i) => `<i class="${i < a.exercises.done ? "is-done" : ""}"></i>`).join("")}</div>
              <p class="d-p">Próximo: ${esc(a.exercises.next.toLowerCase())}, do padrão <code class="d-code" lang="en">depend of → depend on</code>.</p>
            </section>
            <section class="d-card" aria-labelledby="d-t">
              <div class="d-card-head"><b id="d-t">Desafio de hoje</b><span>foco: ${esc(a.challenge.focus.toLowerCase())}</span></div>
              <h2 class="d-h2s" lang="en">${esc(a.challenge.title)}</h2>
              <p class="d-p" lang="en">${esc(a.challenge.prompt)}</p>
              <button type="button" class="d-ghost">Começar a escrever</button>
            </section>
          </div>
        </div>
      </div>`;
    return shell(
      data,
      ctx,
      `<b>Treino</b>`,
      `<button type="button" class="d-ghost">Ajuda</button>`,
      body
    );
  };

  const practice = (data, ctx) => {
    const x = data.exercise;
    const segs = Array.from({ length: x.total }, (_, i) =>
      i < x.position - 1 ? "is-done" : i === x.position - 1 ? "is-wrong" : ""
    );
    const states = ["Ativo", "Melhorando", "Dominado"];
    const body = `
      <div class="d-desk d-drill">
        <section class="d-editor" aria-labelledby="d-ex-title">
          <div class="d-ex-head">
            <span class="d-pill">${esc(x.type)}</span>
            <code class="d-key-chip" lang="en">depend-on-preposition</code>
            <span class="d-ex-count">${x.position} / ${x.total}</span>
          </div>
          <div class="d-segments d-segments-lg" role="img" aria-label="Exercício ${x.position} de ${x.total}: 2 certos, este errado">${segs.map((s) => `<i class="${s}"></i>`).join("")}</div>
          <h1 id="d-ex-title">${esc(x.instruction)}</h1>
          <p class="d-sentence" lang="en">${esc(x.before)} <span class="d-input-inline is-wrong"><span class="sr-only">Sua resposta:</span>${esc(x.answer)}${svg("cross", 14)}</span> ${esc(x.after)}</p>
          <div class="d-result" role="status">
            <span class="d-result-icon">${svg("cross", 16)}</span>
            <div><b>Incorreta.</b> Resposta esperada: <code class="d-new" lang="en">${esc(x.expected)}</code><p lang="en">${esc(x.full)}</p></div>
          </div>
          <section class="d-why" aria-labelledby="d-why-title">
            <h2 id="d-why-title">Por quê</h2>
            <p>${rich(x.rule)}</p>
            <p>${rich(x.tip)}</p>
          </section>
          <section class="d-why" aria-labelledby="d-from-title">
            <h2 id="d-from-title">${esc(x.origin.where)}</h2>
            <p class="d-quote" lang="en">${esc(x.origin.before)}<code class="d-old">${esc(x.origin.wrong)}</code> <span class="d-to" aria-hidden="true">→</span> <code class="d-new">${esc(x.origin.right)}</code>${esc(x.origin.after)}</p>
          </section>
          <div class="d-ex-foot"><span><kbd>↵</kbd> continuar · <kbd>Esc</kbd> sair do treino</span><button type="button" class="d-primary">Continuar <kbd>↵</kbd></button></div>
        </section>
        <aside class="d-inspector" aria-label="Padrão deste exercício">
          <div class="d-label">Padrão</div>
          <p class="d-pattern" lang="en"><code class="d-old">${esc(x.pattern.from)}</code> <span class="d-to" aria-hidden="true">→</span> <code class="d-new">${esc(x.pattern.to)}</code></p>
          <div class="d-tags d-tags-flat"><span>${esc(x.pattern.category)}</span><span>Vem do português</span><span>${x.pattern.occurrences} ocorrências</span></div>
          <div class="d-label d-mt">Domínio</div>
          <ol class="d-states">${states.map((s) => `<li class="${s === x.pattern.mastery ? "is-on" : ""}">${s}</li>`).join("")}</ol>
          <p class="d-p d-small">${esc(x.pattern.note)}</p>
          <div class="d-label d-mt">Fixação</div>
          <div class="d-recall-big"><span class="d-recall" aria-hidden="true"><i style="width:${x.pattern.recall}%"></i></span><b>${x.pattern.recall}%</b></div>
          <div class="d-label d-mt">Ocorrências recentes</div>
          <ul class="d-occ">${x.history.map((h) => `<li><code lang="en">${esc(h.text)}</code><span>${esc(h.where)} · ${esc(h.when)}</span></li>`).join("")}</ul>
          <div class="d-label d-mt">Fila</div>
          <ol class="d-queue-list">${x.queue.map((q, i) => `<li class="${i < x.position - 1 ? "is-done" : i === x.position - 1 ? "is-on" : ""}"><span>${i + 1}</span>${esc(q)}</li>`).join("")}</ol>
        </aside>
      </div>`;
    return shell(
      data,
      ctx,
      `<span>Treino</span><i>/</i><span>Exercícios</span><i>/</i><b>${x.position} de ${x.total}</b>`,
      `<button type="button" class="d-ghost">Pular <kbd>S</kbd></button>`,
      body
    );
  };

  window.VARIANTS.D = {
    name: "Console",
    tagline:
      "Uma ferramenta de trabalho densa e calma: menu lateral, editor ao lado de um inspetor, tabelas e atalhos de teclado.",
    render: (screen, data, ctx) =>
      ({ desk, progress, academy, practice })[screen](data, ctx),
  };
})();
