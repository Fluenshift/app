// PROTOTYPE (#333), throwaway. Direction A, "Caderno": a ruled notebook page, a highlighter and a
// red pen. The text sits on the page's lines; the corrections live in its margin, the way a
// teacher marks a draft, and the grade is circled by hand.
(function () {
  const P = window.PROTO;
  const { esc, num, int, rich, segments } = P;

  // A loop drawn by hand around the grade: it overshoots where it started.
  const penLoop = `<svg class="a-loop" viewBox="0 0 120 120" aria-hidden="true"><path d="M70 9 C101 10 116 36 112 64 C108 95 80 114 52 110 C23 106 6 82 9 54 C12 27 35 9 63 11 C70 12 76 13 81 16"/></svg>`;
  const penTick = (ok) =>
    ok
      ? `<svg class="a-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13 C7 15 9 18 10 20 C13 13 17 8 21 4"/></svg>`
      : `<svg class="a-tick a-tick-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5 C10 10 15 15 20 20 M19 4 C14 10 10 14 4 20"/></svg>`;

  const header = (data, ctx) => `
    <header class="a-top">
      <a class="a-mark" href="${ctx.href("desk")}"><span>Grifando</span></a>
      <nav class="a-nav" aria-label="Principal">
        ${data.nav
          .map((item) => {
            const live = ["desk", "progress", "academy"].includes(item.key);
            const on =
              item.key === ctx.screen ||
              (item.key === "academy" && ctx.screen === "practice");
            const cls = item.key === "settings" ? " a-nav-end" : "";
            return live
              ? `<a class="${on ? "is-on" : ""}${cls}" href="${ctx.href(item.key)}"${on ? ' aria-current="page"' : ""}>${item.label}</a>`
              : `<span class="is-off${cls}" title="Fora deste protótipo">${item.label}</span>`;
          })
          .join("")}
      </nav>
    </header>`;

  const desk = (data, ctx) => {
    const e = data.evaluation;
    const text = segments(e, {
      code: (code) => `<code class="a-code">${esc(code)}</code>`,
      finding: (t, f) =>
        `<mark class="a-hl" data-link="f${f.n}" tabindex="0" aria-describedby="a-note-${f.n}">${esc(t)}<sup>${f.n}</sup></mark>`,
      suggestion: (t, s) =>
        `<span class="a-sugg" data-link="s${s.n}" tabindex="0" aria-describedby="a-sugg-${s.n}">${esc(t)}<sup>s</sup></span>`,
    });
    const notes = e.findings
      .map(
        (f) => `
        <li class="a-note" id="a-note-${f.n}" data-link="f${f.n}">
          <div class="a-note-head"><span class="a-num" aria-label="Erro ${f.n}">${f.n}</span><s lang="en">${esc(f.original)}</s> <span class="a-pen" lang="en">${esc(f.correction)}</span></div>
          <p>${rich(f.explanation)}</p>
          <div class="a-tags"><span>${esc(f.category)}</span><span class="a-sev a-sev-${f.severity.toLowerCase()}">${f.severity}</span>${f.l1 ? `<span class="a-l1">Vem do português</span>` : ""}</div>
        </li>`
      )
      .join("");
    const sugg = e.suggestions
      .map(
        (s) => `
        <li class="a-note a-note-sugg" id="a-sugg-${s.n}" data-link="s${s.n}">
          <div class="a-note-head"><span class="a-num a-num-s" aria-label="Sugestão">s</span><span class="a-blue" lang="en">${esc(s.alternative)}</span></div>
          <p>${rich(s.why)}</p>
          <div class="a-tags"><span>Sugestão, não é erro</span></div>
        </li>`
      )
      .join("");
    const bands = data.bands
      .map(
        (b) =>
          `<li class="${b.name === e.band ? "is-on" : ""}"><span>${b.from}–${b.to}</span> ${b.name}</li>`
      )
      .join("");
    return `
    ${header(data, ctx)}
    <main class="a-desk">
      <section class="a-compose" aria-labelledby="a-new">
        <div class="a-compose-top">
          <h2 id="a-new" class="a-eyebrow">Novo texto</h2>
          <div class="a-kinds" role="radiogroup" aria-label="Tipo de texto">
            <span class="a-kinds-label" aria-hidden="true">Tipo de texto</span>
            ${data.textKinds.map((k) => `<button type="button" role="radio" aria-checked="${k === e.textKind}" class="${k === e.textKind ? "is-on" : ""}">${k}</button>`).join("")}
          </div>
        </div>
        <label class="sr-only" for="a-input">Texto em inglês</label>
        <textarea id="a-input" class="a-input" placeholder="Cole aqui um prompt, uma issue ou a descrição de um pull request…" rows="3"></textarea>
        <div class="a-compose-row">
          <label class="a-check"><input type="checkbox" /> <span>É treino</span> <em>não entra no Progresso</em></label>
          <button type="button" class="a-btn">Avaliar</button>
        </div>
      </section>

      <div class="a-spread">
        <article class="a-sheet" aria-labelledby="a-title">
          <div class="a-sheet-head">
            <div>
              <p class="a-eyebrow">${esc(e.textKind)} · ${esc(e.when)}</p>
              <h1 id="a-title" lang="en">${esc(e.title)}</h1>
              <p class="a-meta">${e.words} palavras em inglês · ${num(e.findingRate)} erros por 100 palavras · ${e.codeSpans} trecho de código fora da avaliação · Rubrica ${e.rubric}</p>
            </div>
            <div class="a-grade" role="img" aria-label="Nota ${e.score} de 100, faixa ${e.band}">${penLoop}<b>${e.score}</b><span>${e.band}</span></div>
          </div>
          <ol class="a-bands" aria-label="Faixas da nota">${bands}</ol>
          <p class="a-text" lang="en">${text}</p>
        </article>
        <aside class="a-margin" aria-labelledby="a-margin-title">
          <h2 id="a-margin-title" class="a-eyebrow">${e.findings.length} erros · ${e.suggestions.length} sugestão</h2>
          <ol>${notes}${sugg}</ol>
        </aside>
        <section class="a-corrected" aria-labelledby="a-corr">
          <h2 id="a-corr">Versão corrigida <button type="button" class="a-link">Copiar</button></h2>
          <p lang="en">${P.corrected(e.corrected, (c) => `<code class="a-code">${esc(c)}</code>`)}</p>
        </section>
      </div>
    </main>`;
  };

  const progress = (data, ctx) => {
    const p = data.progress;
    const kmax = Math.max(...p.byKind.map((k) => k.rate));
    const cmax = Math.max(...p.categories.flatMap((c) => c.series));
    const multiples = p.categories
      .map((c) => {
        const { first, last } = P.firstLast(c.series);
        return `<li>
          <div class="a-mult-head"><b>${esc(c.name)}</b><span>${c.count}</span></div>
          ${P.miniBars(c.series, { width: 220, height: 48, max: cmax, days: p.days, className: "a-mb" })}
          <p>7 primeiros dias: ${first} · 7 últimos: ${last}</p>
        </li>`;
      })
      .join("");
    return `
    ${header(data, ctx)}
    <main class="a-report">
      <div class="a-report-head">
        <div>
          <p class="a-eyebrow">${esc(p.period)} · ${esc(p.seriesStart)} a ${esc(p.seriesEnd)}</p>
          <h1>Progresso</h1>
          <p class="a-hint">Só textos de trabalho entram aqui. O treino fica de fora.</p>
        </div>
        <div class="a-report-tools">
          <div class="a-periods" role="radiogroup" aria-label="Período">${["7 dias", "30 dias", "Tudo"].map((x) => `<button type="button" role="radio" aria-checked="${x === "30 dias"}" class="${x === "30 dias" ? "is-on" : ""}">${x}</button>`).join("")}</div>
          <label class="a-filter"><span>Tipo de texto</span><select><option>Todos</option>${data.textKinds.map((k) => `<option>${k}</option>`).join("")}</select></label>
        </div>
      </div>
      <section class="a-figures" aria-label="Resumo do período">
        <div class="a-figure a-figure-main"><b>${num(p.findingRate)}</b><span>erros por 100 palavras em inglês</span><em>Medida principal · ${p.findings} erros em ${int(p.words)} palavras</em></div>
        <div class="a-figure"><b>${p.evaluations}</b><span>avaliações</span></div>
        <div class="a-figure"><b>${int(p.words)}</b><span>palavras em inglês</span></div>
        <div class="a-figure"><b>${p.averageScore}</b><span>nota média</span><em>Secundária</em></div>
      </section>
      <section class="a-chart-card" aria-labelledby="a-c1">
        <h2 id="a-c1">Taxa de erros, dia a dia</h2>
        <p class="a-hint">Erros por 100 palavras em cada dia com avaliações. Dias sem texto ficam em branco, sem ponto.</p>
        <div class="a-graph">${P.lineChart(p.series, { width: 960, height: 240, labels: [p.seriesStart, p.seriesEnd], days: p.days, className: "a-lc", dot: 4.2, label: `Taxa de erros por dia. ${P.rateSummary(p)}` })}</div>
        <p class="a-summary">${P.rateSummary(p)}</p>
        <details class="a-data"><summary>Ver os dados em tabela</summary>${P.rateTable(p)}</details>
      </section>
      <section class="a-chart-card" aria-labelledby="a-c2">
        <h2 id="a-c2">Categorias de erro ao longo do tempo</h2>
        <p class="a-hint">Erros por dia em cada categoria, na mesma escala. O número ao lado do nome é o total do período.</p>
        <ul class="a-multiples">${multiples}</ul>
        <details class="a-data"><summary>Ver os dados em tabela</summary>${P.categoryTable(p)}</details>
      </section>
      <div class="a-two">
        <section aria-labelledby="a-c3">
          <h2 id="a-c3">Por tipo de texto</h2>
          <p class="a-hint">Erros por 100 palavras no período.</p>
          <ul class="a-kindbars">
            ${p.byKind.map((k) => `<li><span class="a-kind-name">${k.kind}</span><span class="a-bar" aria-hidden="true"><i style="width:${((k.rate / kmax) * 100).toFixed(1)}%"></i></span><b>${num(k.rate)}</b><em>${k.evaluations} avaliações${k.few ? " · poucos dados" : ""}</em></li>`).join("")}
          </ul>
          <details class="a-data"><summary>Ver os dados em tabela</summary>${P.kindTable(p)}</details>
        </section>
        <section aria-labelledby="a-c4">
          <h2 id="a-c4">Observações</h2>
          <ol class="a-insights">${p.insights.map((i) => `<li>${rich(i.text)} <a href="#" class="a-ev">Ver os erros →</a></li>`).join("")}</ol>
        </section>
      </div>
    </main>`;
  };

  const academy = (data, ctx) => {
    const a = data.academy;
    const review = [...a.patterns].sort((x, y) => x.recall - y.recall).slice(0, 3);
    return `
    ${header(data, ctx)}
    <main class="a-notebook">
      <section class="a-page a-page-left" aria-labelledby="a-today">
        <p class="a-eyebrow">Treino · sexta, 27 de novembro</p>
        <h1 id="a-today">Desafio de hoje</h1>
        <p class="a-prompt-title" lang="en">${esc(a.challenge.title)}</p>
        <p class="a-prompt" lang="en">${esc(a.challenge.prompt)}</p>
        <div class="a-lines" aria-hidden="true"></div>
        <div class="a-compose-row"><span class="a-hint">Foco: ${esc(a.challenge.focus.toLowerCase())} · ${esc(a.challenge.source)}</span><button type="button" class="a-btn">Começar a escrever</button></div>
        <div class="a-box">
          <div>
            <h2>Exercícios</h2>
            <p>${a.exercises.ready} prontos, feitos dos seus erros. Você já fez ${a.exercises.done}.</p>
          </div>
          <a class="a-btn" href="${ctx.href("practice")}">Continuar</a>
        </div>
      </section>

      <section class="a-page a-page-right" aria-labelledby="a-book">
        <p class="a-eyebrow">Caderno de erros</p>
        <h1 id="a-book">Para revisar</h1>
        <p class="a-hint">Os padrões que você mais pode esquecer vêm primeiro.</p>
        <ul class="a-patterns">
          ${review
            .map(
              (p) => `
            <li>
              <div class="a-pattern-ex" lang="en"><s>${esc(p.example[0])}</s> <span class="a-pen">${esc(p.example[1])}</span></div>
              <div class="a-pattern-meta">${esc(p.category)}${p.l1 ? " · vem do português" : ""} · ${p.occurrences} vezes · última ${esc(p.last)}</div>
              <span class="a-mastery a-m-${p.mastery.toLowerCase()}${p.fading ? " is-fading" : ""}">${p.mastery}${p.fading ? ", enfraquecendo" : ""}</span>
            </li>`
            )
            .join("")}
        </ul>
        <a class="a-more" href="#">Abrir o caderno inteiro, com os ${a.patterns.length} padrões →</a>
        <p class="a-eyebrow a-gap">Outros treinos</p>
        <ul class="a-toc">
          ${a.modes
            .filter((m) => m.key !== "exercises")
            .map((m) => `<li><a href="#">${esc(m.name)}</a><i aria-hidden="true"></i><em>${esc(m.detail)}</em></li>`)
            .join("")}
        </ul>
      </section>
    </main>`;
  };

  const practice = (data, ctx) => {
    const x = data.exercise;
    const marks = Array.from({ length: x.total }, (_, i) => {
      if (i < x.position - 1) return `<li class="is-done" aria-label="Exercício ${i + 1}: certo">${penTick(true)}</li>`;
      if (i === x.position - 1) return `<li class="is-wrong" aria-label="Exercício ${i + 1}: errado">${penTick(false)}</li>`;
      return `<li aria-label="Exercício ${i + 1}: a fazer"></li>`;
    }).join("");
    return `
    ${header(data, ctx)}
    <main class="a-worksheet">
      <article class="a-ws" aria-labelledby="a-ws-title">
        <div class="a-ws-main">
          <div class="a-ws-top">
            <p class="a-eyebrow">Treino · exercício ${x.position} de ${x.total} · ${esc(x.type)}</p>
            <ol class="a-ws-marks" aria-label="Exercícios desta rodada">${marks}</ol>
          </div>
          <h1 id="a-ws-title">${esc(x.instruction)}</h1>
          <p class="a-ws-sentence" lang="en">${esc(x.before)} <span class="a-blank"><s class="a-student">${esc(x.answer)}</s><span class="a-pen a-fix">${esc(x.expected)}</span></span> ${esc(x.after)}</p>
          <p class="a-verdict" role="status">${penTick(false)}<span>Não foi dessa vez. Sua resposta: <s lang="en">${esc(x.answer)}</s>. Resposta certa: <b lang="en">${esc(x.expected)}</b>.</span></p>
          <p class="a-full"><span class="a-eyebrow">A frase certa</span> <span lang="en">${esc(x.full)}</span></p>
          <section class="a-origin" aria-labelledby="a-origin-title">
            <h2 id="a-origin-title" class="a-eyebrow">Do seu texto · ${esc(x.origin.where.replace("No seu ", ""))}</h2>
            <blockquote lang="en">${esc(x.origin.before)}<mark class="a-hl">${esc(x.origin.wrong)}</mark> <span class="a-pen">${esc(x.origin.right)}</span>${esc(x.origin.after)}</blockquote>
          </section>
          <div class="a-ws-foot">
            <div class="a-pattern-state"><p><span class="a-eyebrow">Padrão</span> <span lang="en"><s>${esc(x.pattern.from)}</s> <span class="a-pen">${esc(x.pattern.to)}</span></span> · ${esc(x.pattern.category)} · <span class="a-mastery a-m-ativo">${x.pattern.mastery}</span></p><p class="a-hint">${esc(x.pattern.note)}</p></div>
            <div class="a-ws-actions"><span class="a-hint">Próximo: ${esc(x.next)}</span><button type="button" class="a-btn">Continuar</button></div>
          </div>
        </div>
        <aside class="a-margin a-ws-margin" aria-labelledby="a-why">
          <h2 id="a-why" class="a-eyebrow">Por quê</h2>
          <p class="a-why">${rich(x.rule)}</p>
          <p class="a-why">${rich(x.tip)}</p>
          <div class="a-tags"><span>${esc(x.pattern.category)}</span><span class="a-l1">Vem do português</span></div>
        </aside>
      </article>
    </main>`;
  };

  window.VARIANTS.A = {
    name: "Caderno",
    tagline:
      "Seu texto numa folha pautada: marca-texto no erro, caneta vermelha na margem, nota circulada à mão.",
    render: (screen, data, ctx) =>
      ({ desk, progress, academy, practice })[screen](data, ctx),
  };
})();
