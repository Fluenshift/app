// PROTOTYPE (#333), throwaway. Direction D, "Console": a calm, dense work tool in the style of
// modern SaaS apps. A sidebar, an editor beside an inspector, tables and tiles for the numbers.
(function () {
  const { esc, segments, lineChart } = window.PROTO;

  const icons = {
    desk: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    history: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    progress: '<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/>',
    academy:
      '<path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 11v4c0 1 2.5 3 5 3s5-2 5-3v-4"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  };
  const svg = (name) =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  const counts = { history: "43", academy: "8" };

  const shell = (data, ctx, crumbs, actions, body) => `
    <div class="d-app">
      <aside class="d-side">
        <div class="d-ws"><span class="d-logo">G</span><b>Grifando</b><span class="d-ws-tag">Local</span></div>
        <button type="button" class="d-newbtn">New text <kbd>N</kbd></button>
        <nav class="d-nav" aria-label="Primary">
          ${data.nav
            .filter((i) => i.key !== "settings")
            .map((item) => {
              const live = ["desk", "progress", "academy"].includes(item.key);
              const on = item.key === ctx.screen;
              const count = counts[item.key]
                ? `<em>${counts[item.key]}</em>`
                : "";
              return live
                ? `<a class="${on ? "is-on" : ""}" href="${ctx.href(item.key)}">${svg(item.key)}<span>${item.label}</span>${count}</a>`
                : `<span class="is-off" title="Not in this prototype">${svg(item.key)}<span>${item.label}</span>${count}</span>`;
            })
            .join("")}
        </nav>
        <div class="d-side-label">Recent</div>
        <ul class="d-recent">${data.history
          .slice(0, 4)
          .map(
            (h) =>
              `<li><i class="d-dot d-dot-${h.band.toLowerCase()}"></i>${esc(h.title)}</li>`
          )
          .join("")}</ul>
        <div class="d-side-foot">
          <span class="is-off">${svg("settings")}<span>Settings</span></span>
          <div class="d-key"><i></i>OpenRouter key set</div>
        </div>
      </aside>
      <div class="d-main">
        <header class="d-bar"><div class="d-crumbs">${crumbs}</div><div class="d-actions">${actions}</div></header>
        ${body}
      </div>
    </div>`;

  const sevDot = (s) =>
    `<i class="d-sev d-sev-${s.toLowerCase()}" title="${s}"></i>`;

  const desk = (data, ctx) => {
    const e = data.evaluation;
    const text = segments(e, {
      code: (code) => `<code class="d-code">${esc(code)}</code>`,
      finding: (t, f) =>
        `<span class="d-mk d-mk-${f.severity.toLowerCase()}${f.n === 3 ? " is-sel" : ""}">${esc(t)}</span>`,
      suggestion: (t) => `<span class="d-mk d-mk-idea">${esc(t)}</span>`,
    });
    const body = `
      <div class="d-desk">
        <section class="d-editor">
          <div class="d-editor-top">
            <div class="d-seg">${data.textKinds.map((k) => `<button type="button" class="${k === e.textKind ? "is-on" : ""}">${k}</button>`).join("")}</div>
            <label class="d-check"><input type="checkbox"/> Practice <span>not counted in Progress</span></label>
          </div>
          <h1>${esc(e.title)}</h1>
          <div class="d-sub">${esc(e.when)} · ${e.words} English words · ${e.codeSpans} code span left out · Rubric ${e.rubric}</div>
          <p class="d-text">${text}</p>
          <div class="d-compose"><textarea rows="2" placeholder="Paste a new text to evaluate…"></textarea><button type="button" class="d-primary">Evaluate <kbd>⌘</kbd><kbd>↵</kbd></button></div>
        </section>
        <aside class="d-inspector">
          <div class="d-scorecard">
            <div><div class="d-label">Score</div><div class="d-score"><b>${e.score}</b><span class="d-band">${e.band}</span></div></div>
            <div><div class="d-label">Finding Rate</div><div class="d-rate"><b>${e.findingRate}</b><span>per 100 words</span></div></div>
          </div>
          <div class="d-scale"><i style="left:${e.score}%"></i><span style="width:50%">Needs revision</span><span style="width:20%">Underst.</span><span style="width:15%" class="is-on">Clear</span><span style="width:15%">Natural</span></div>
          <div class="d-tabs"><span class="is-on">Findings <em>${e.findings.length}</em></span><span>Suggestions <em>${e.suggestions.length}</em></span><span>Corrected</span></div>
          <ul class="d-findings">
            ${e.findings
              .map(
                (f) => `<li class="${f.n === 3 ? "is-open" : ""}">
                  <div class="d-frow">${sevDot(f.severity)}<code class="d-old">${esc(f.original)}</code><span class="d-to">→</span><code class="d-new">${esc(f.correction)}</code><span class="d-cat">${esc(f.category)}</span></div>
                  ${f.n === 3 ? `<p>${esc(f.explanation)}</p><div class="d-tags"><span>${f.severity}</span>${f.l1 ? "<span>From Portuguese</span>" : ""}<span>Pattern: depend on</span></div>` : ""}
                </li>`
              )
              .join("")}
          </ul>
        </aside>
      </div>`;
    return shell(
      data,
      ctx,
      `<span>Write</span><i>/</i><b>${esc(e.title)}</b>`,
      `<button type="button" class="d-ghost">Copy corrected</button><button type="button" class="d-ghost">Delete</button>`,
      body
    );
  };

  const progress = (data, ctx) => {
    const p = data.progress;
    const total = p.categories.reduce((s, c) => s + c.count, 0);
    const max = Math.max(...p.categories.map((c) => c.count));
    const kmax = Math.max(...p.byKind.map((k) => k.rate));
    const spark = lineChart(p.series, {
      width: 180,
      height: 44,
      pad: { top: 4, right: 2, bottom: 4, left: 2 },
      ticks: [],
      dot: 0,
      className: "d-spark",
    });
    const body = `
      <div class="d-page">
        <div class="d-page-head">
          <h1>Progress</h1>
          <div class="d-filters"><div class="d-seg">${["7d", "30d", "All"].map((x) => `<button type="button" class="${x === "30d" ? "is-on" : ""}">${x}</button>`).join("")}</div><button type="button" class="d-ghost">All Text Kinds ▾</button><button type="button" class="d-ghost">Rubric 1-provisional</button></div>
        </div>
        <div class="d-kpis">
          <div class="d-kpi d-kpi-main"><div class="d-label">Finding Rate <span class="d-pill">Primary</span></div><b>${p.findingRate}</b><span>Findings per 100 English words</span>${spark}</div>
          <div class="d-kpi"><div class="d-label">Evaluations</div><b>${p.evaluations}</b><span>work texts</span></div>
          <div class="d-kpi"><div class="d-label">English words</div><b>${p.words.toLocaleString("en")}</b><span>evaluated</span></div>
          <div class="d-kpi"><div class="d-label">Average score <span class="d-pill d-pill-muted">Secondary</span></div><b>${p.averageScore}</b><span>of 100</span></div>
        </div>
        <section class="d-card">
          <div class="d-card-head"><b>Finding Rate per day</b><span>${p.seriesStart} to ${p.seriesEnd} · days with no Evaluation stay empty</span></div>
          ${lineChart(p.series, { width: 1000, height: 230, labels: [p.seriesStart, p.seriesEnd], className: "d-lc" })}
        </section>
        <div class="d-grid">
          <section class="d-card">
            <div class="d-card-head"><b>Error Categories</b><span>${p.findings} Findings</span></div>
            <table class="d-table">
              <thead><tr><th>Category</th><th></th><th>Findings</th><th>Share</th></tr></thead>
              <tbody>${p.categories.map((c) => `<tr><td>${esc(c.name)}</td><td class="d-barcell"><span><i style="width:${((c.count / max) * 100).toFixed(1)}%"></i></span></td><td>${c.count}</td><td>${Math.round((c.count / total) * 100)}%</td></tr>`).join("")}</tbody>
            </table>
          </section>
          <div class="d-stack">
            <section class="d-card">
              <div class="d-card-head"><b>By Text Kind</b><span>Findings per 100 words</span></div>
              <ul class="d-kbars">${p.byKind.map((k) => `<li><span>${k.kind}</span><span class="d-kbar"><i style="width:${((k.rate / kmax) * 100).toFixed(0)}%"></i></span><b>${k.rate.toFixed(1)}</b><em>${k.evaluations} evals</em></li>`).join("")}</ul>
            </section>
            <section class="d-card">
              <div class="d-card-head"><b>Insights</b><span>each one opens its Findings</span></div>
              <ul class="d-insights">${p.insights.map((i) => `<li><span>${esc(i.text)}</span><button type="button" class="d-ghost d-xs">Evidence</button></li>`).join("")}</ul>
            </section>
          </div>
        </div>
      </div>`;
    return shell(
      data,
      ctx,
      `<b>Progress</b>`,
      `<button type="button" class="d-ghost">Help</button>`,
      body
    );
  };

  const academy = (data, ctx) => {
    const a = data.academy;
    const x = a.exercise;
    const recall = [35, 48, 62, 41, 88];
    const body = `
      <div class="d-page">
        <div class="d-page-head">
          <h1>Academy</h1>
          <div class="d-subnav">${["Overview", "Exercises", "Mistakes", "Explain code", "Technical", "Interview"].map((t, i) => `<span class="${i === 0 ? "is-on" : ""}${t === "Interview" ? " is-off" : ""}">${t}${t === "Interview" ? " · on hold" : ""}</span>`).join("")}</div>
        </div>
        <div class="d-acad">
          <section class="d-card">
            <div class="d-card-head"><b>Review queue</b><span>lowest Recall first</span></div>
            <table class="d-table d-queue">
              <thead><tr><th>Pattern</th><th>Category</th><th>Seen</th><th>Mastery</th><th>Recall</th></tr></thead>
              <tbody>${a.patterns
                .map(
                  (p, i) =>
                    `<tr><td><code class="d-old">${esc(p.example[0])}</code> <span class="d-to">→</span> <code class="d-new">${esc(p.example[1])}</code></td><td>${esc(p.category)}${p.l1 ? ' <span class="d-pill d-pill-muted">PT</span>' : ""}</td><td>${p.occurrences}×</td><td><span class="d-status d-st-${p.mastery.toLowerCase()}${p.fading ? " is-fading" : ""}">${p.mastery}${p.fading ? " · fading" : ""}</span></td><td><span class="d-recall"><i style="width:${recall[i]}%"></i></span> ${recall[i]}%</td></tr>`
                )
                .join("")}</tbody>
            </table>
            <div class="d-card-head d-mt"><b>Practice</b></div>
            <div class="d-modes">${a.practice.map((p) => `<button type="button" class="d-mode${p.muted ? " is-off" : ""}"><b>${esc(p.name)}</b><span>${esc(p.detail)}</span></button>`).join("")}</div>
          </section>
          <div class="d-stack">
            <section class="d-card d-next">
              <div class="d-card-head"><b>Up next</b><span>Exercise ${x.position} of ${x.total} · ${esc(x.type)}</span></div>
              <h2>${esc(x.question)}</h2>
              <ul class="d-options">${x.options.map((o, i) => `<li><kbd>${String.fromCharCode(65 + i)}</kbd>${esc(o)}</li>`).join("")}</ul>
              <div class="d-next-foot"><span>Built from your Prepositions pattern</span><button type="button" class="d-primary">Check</button></div>
            </section>
            <section class="d-card">
              <div class="d-card-head"><b>Today</b><span>focus: ${esc(a.challenge.focus)}</span></div>
              <h2 class="d-h2s">${esc(a.challenge.title)}</h2>
              <p class="d-p">${esc(a.challenge.prompt)}</p>
              <button type="button" class="d-ghost">Start writing</button>
            </section>
          </div>
        </div>
      </div>`;
    return shell(
      data,
      ctx,
      `<b>Academy</b>`,
      `<button type="button" class="d-ghost">8 exercises ready</button>`,
      body
    );
  };

  window.VARIANTS.D = {
    name: "Console",
    render: (screen, data, ctx) =>
      ({ desk, progress, academy })[screen](data, ctx),
  };
})();
