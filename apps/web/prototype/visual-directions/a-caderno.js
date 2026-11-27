// PROTOTYPE (#333), throwaway. Direction A, "Caderno": a sheet of paper, a highlighter and a red
// pen. The text is the page; the corrections live in its margin, the way a teacher marks a draft.
(function () {
  const { esc, segments, lineChart } = window.PROTO;

  const header = (data, ctx) => `
    <header class="a-top">
      <a class="a-mark" href="${ctx.href("desk")}"><span>Grifando</span></a>
      <nav class="a-nav" aria-label="Primary">
        ${data.nav
          .map((item) => {
            const live = ["desk", "progress", "academy"].includes(item.key);
            const on = item.key === ctx.screen;
            return live
              ? `<a class="${on ? "is-on" : ""}" href="${ctx.href(item.key)}">${item.label}</a>`
              : `<span class="is-off" title="Not in this prototype">${item.label}</span>`;
          })
          .join("")}
      </nav>
    </header>`;

  const desk = (data, ctx) => {
    const e = data.evaluation;
    const text = segments(e, {
      code: (code) => `<code class="a-code">${esc(code)}</code>`,
      finding: (t, f) =>
        `<mark class="a-hl" id="a-f${f.n}">${esc(t)}<sup>${f.n}</sup></mark>`,
      suggestion: (t) => `<span class="a-sugg">${esc(t)}<sup>s</sup></span>`,
    });
    const notes = e.findings
      .map(
        (f) => `
        <li class="a-note">
          <div class="a-note-head"><span class="a-num">${f.n}</span><s>${esc(f.original)}</s> <span class="a-pen">${esc(f.correction)}</span></div>
          <p>${esc(f.explanation)}</p>
          <div class="a-tags"><span>${esc(f.category)}</span><span class="a-sev a-sev-${f.severity.toLowerCase()}">${f.severity}</span>${f.l1 ? `<span title="Carried over from Portuguese">from Portuguese</span>` : ""}</div>
        </li>`
      )
      .join("");
    const sugg = e.suggestions
      .map(
        (s) => `
        <li class="a-note a-note-sugg">
          <div class="a-note-head"><span class="a-num a-num-s">s</span><span class="a-blue">${esc(s.alternative)}</span></div>
          <p>${esc(s.why)}</p>
          <div class="a-tags"><span>Suggestion, not an error</span></div>
        </li>`
      )
      .join("");
    return `
    ${header(data, ctx)}
    <main class="a-desk">
      <section class="a-compose" aria-label="New text">
        <div class="a-kinds" role="radiogroup" aria-label="Text Kind">
          ${data.textKinds.map((k) => `<button type="button" role="radio" aria-checked="${k === e.textKind}" class="${k === e.textKind ? "is-on" : ""}">${k}</button>`).join("")}
        </div>
        <textarea class="a-input" placeholder="Paste a prompt, an issue or a pull request description…" rows="3"></textarea>
        <div class="a-compose-row">
          <label class="a-check"><input type="checkbox" /> This is practice <span>(kept out of Progress)</span></label>
          <button type="button" class="a-btn">Evaluate</button>
        </div>
      </section>

      <div class="a-spread">
        <article class="a-sheet">
          <div class="a-sheet-head">
            <div>
              <div class="a-eyebrow">${esc(e.textKind)} · ${esc(e.when)}</div>
              <h1>${esc(e.title)}</h1>
              <div class="a-meta">${e.words} English words · ${e.findingRate} Findings per 100 words · Rubric ${e.rubric} · ${e.codeSpans} code span left out</div>
            </div>
            <div class="a-stamp" aria-label="Score ${e.score}, ${e.band}"><b>${e.score}</b><span>${e.band}</span></div>
          </div>
          <p class="a-text">${text}</p>
          <details class="a-corrected" open>
            <summary>Corrected version</summary>
            <p>${esc(e.corrected).replace(/`([^`]+)`/g, '<code class="a-code">$1</code>')}</p>
          </details>
        </article>
        <aside class="a-margin" aria-label="Corrections">
          <ol>${notes}${sugg}</ol>
        </aside>
      </div>
    </main>`;
  };

  const progress = (data, ctx) => {
    const p = data.progress;
    const max = Math.max(...p.categories.map((c) => c.count));
    return `
    ${header(data, ctx)}
    <main class="a-report">
      <div class="a-report-head">
        <h1>Progress</h1>
        <div class="a-periods"><a>7 days</a><a class="is-on">30 days</a><a>All</a><span class="a-filter">All Text Kinds ▾</span></div>
      </div>
      <section class="a-figures">
        <div class="a-figure a-figure-main"><b>${p.findingRate}</b><span>Findings per 100 English words</span><em>primary measure</em></div>
        <div class="a-figure"><b>${p.evaluations}</b><span>Evaluations</span></div>
        <div class="a-figure"><b>${p.words.toLocaleString("en")}</b><span>English words</span></div>
        <div class="a-figure"><b>${p.averageScore}</b><span>average score</span><em>secondary</em></div>
      </section>
      <section class="a-chart-card">
        <h2>Finding Rate, day by day</h2>
        <p class="a-hint">Each dot is one day's Evaluations. Days without writing stay empty.</p>
        ${lineChart(p.series, { width: 760, height: 220, labels: [p.seriesStart, p.seriesEnd], className: "a-lc" })}
      </section>
      <div class="a-two">
        <section>
          <h2>Error Categories</h2>
          <ul class="a-bars">
            ${p.categories.map((c) => `<li><span class="a-bar-label">${esc(c.name)}</span><span class="a-bar"><i style="width:${((c.count / max) * 100).toFixed(1)}%"></i></span><b>${c.count}</b></li>`).join("")}
          </ul>
        </section>
        <section>
          <h2>By Text Kind</h2>
          <table class="a-table">
            <thead><tr><th>Kind</th><th>Findings per 100 words</th><th>Evaluations</th></tr></thead>
            <tbody>${p.byKind.map((k) => `<tr><td>${k.kind}</td><td>${k.rate}</td><td>${k.evaluations}</td></tr>`).join("")}</tbody>
          </table>
          <h2 class="a-gap">Notes</h2>
          <ol class="a-insights">${p.insights.map((i) => `<li>${esc(i.text)} <a>See the evidence →</a></li>`).join("")}</ol>
        </section>
      </div>
    </main>`;
  };

  const academy = (data, ctx) => {
    const a = data.academy;
    const x = a.exercise;
    return `
    ${header(data, ctx)}
    <main class="a-notebook">
      <section class="a-page a-page-left">
        <div class="a-eyebrow">Today</div>
        <h1>${esc(a.challenge.title)}</h1>
        <p class="a-prompt">${esc(a.challenge.prompt)}</p>
        <div class="a-lines" aria-hidden="true"></div>
        <div class="a-compose-row"><span class="a-hint">Focus: ${esc(a.challenge.focus)}</span><button type="button" class="a-btn">Start writing</button></div>

        <div class="a-exercise">
          <div class="a-eyebrow">Exercise ${x.position} of ${x.total} · Prepositions · from your own writing</div>
          <h2>${esc(x.question)}</h2>
          <ol class="a-options">
            ${x.options.map((o, i) => `<li><label><input type="radio" name="a-opt"/> <span>${esc(o)}</span></label></li>`).join("")}
          </ol>
          <div class="a-compose-row"><span class="a-hint">Answer first, then see why.</span><button type="button" class="a-btn">Check</button></div>
        </div>
      </section>

      <section class="a-page a-page-right">
        <div class="a-eyebrow">Mistake notebook</div>
        <h1>Your patterns</h1>
        <ul class="a-patterns">
          ${a.patterns
            .map(
              (p) => `
            <li>
              <div class="a-pattern-ex"><s>${esc(p.example[0])}</s> <span class="a-pen">${esc(p.example[1])}</span></div>
              <div class="a-pattern-meta">${esc(p.category)}${p.l1 ? " · from Portuguese" : ""} · ${p.occurrences}× · last ${esc(p.last).toLowerCase()}</div>
              <span class="a-mastery a-m-${p.mastery.toLowerCase()}${p.fading ? " is-fading" : ""}">${p.mastery}${p.fading ? ", fading" : ""}</span>
            </li>`
            )
            .join("")}
        </ul>
        <div class="a-eyebrow a-gap">Practice</div>
        <ul class="a-toc">
          ${a.practice.map((p) => `<li class="${p.muted ? "is-muted" : ""}"><span>${esc(p.name)}</span><i></i><em>${esc(p.detail)}</em></li>`).join("")}
        </ul>
      </section>
    </main>`;
  };

  window.VARIANTS.A = {
    name: "Caderno",
    render: (screen, data, ctx) =>
      ({ desk, progress, academy })[screen](data, ctx),
  };
})();
