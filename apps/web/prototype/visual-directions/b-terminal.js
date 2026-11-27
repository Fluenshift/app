// PROTOTYPE (#333), throwaway. Direction B, "Terminal": a dark developer tool. The text opens like
// a file in an editor, Findings read like lint problems, and each correction is a suggested change
// in a pull request review.
(function () {
  const { esc, segments, lineChart } = window.PROTO;

  const icon = (name) => {
    const paths = {
      desk: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>',
      history: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
      progress: '<path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/>',
      academy:
        '<path d="M3 9l9-4 9 4-9 4-9-4z"/><path d="M7 11v4c0 1 2.5 3 5 3s5-2 5-3v-4"/>',
      settings:
        '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    };
    return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  };

  const shell = (data, ctx, side, main, status) => `
    <div class="b-app">
      <nav class="b-activity" aria-label="Primary">
        <div class="b-logo" title="Grifando">g<span>_</span></div>
        ${data.nav
          .map((item) => {
            const live = ["desk", "progress", "academy"].includes(item.key);
            const on = item.key === ctx.screen;
            return live
              ? `<a class="${on ? "is-on" : ""}" href="${ctx.href(item.key)}" title="${item.label}">${icon(item.key)}</a>`
              : `<span class="is-off" title="${item.label} (not in this prototype)">${icon(item.key)}</span>`;
          })
          .join("")}
      </nav>
      <aside class="b-side">${side}</aside>
      <main class="b-main">${main}</main>
      <footer class="b-status">${status}</footer>
    </div>`;

  const sevIcon = (severity) =>
    `<span class="b-sev b-sev-${severity.toLowerCase()}">${severity === "Minor" ? "●" : "▲"}</span>`;

  const desk = (data, ctx) => {
    const e = data.evaluation;
    const text = segments(e, {
      code: (code) => `<code class="b-code">${esc(code)}</code>`,
      finding: (t, f) =>
        `<span class="b-lint b-lint-${f.severity.toLowerCase()}" title="${esc(f.category)}">${esc(t)}<sup>${f.n}</sup></span>`,
      suggestion: (t) => `<span class="b-hint-span">${esc(t)}</span>`,
    });
    const side = `
      <div class="b-side-head"><span>HISTORY</span><button type="button" class="b-new">+ New</button></div>
      <ul class="b-files">
        ${data.history
          .map(
            (h, i) => `<li class="${i === 0 ? "is-on" : ""}">
              <span class="b-file-kind b-k-${h.kind.split(" ").join("-").toLowerCase()}">${h.kind === "Pull request" ? "PR" : h.kind.slice(0, 1)}</span>
              <span class="b-file-name">${esc(h.title)}</span>
              <span class="b-file-score b-band-${h.band.toLowerCase().replace(" ", "-")}">${h.score}</span>
            </li>`
          )
          .join("")}
      </ul>`;
    const review = e.findings
      .map(
        (f) => `
        <div class="b-thread">
          <div class="b-thread-head">${sevIcon(f.severity)} <b>${f.n}</b> <span class="b-cat">${esc(f.category)}</span><span class="b-sevname">${f.severity}</span>${f.l1 ? `<span class="b-l1">from Portuguese</span>` : ""}</div>
          <div class="b-diff"><div class="b-del">- ${esc(f.original)}</div><div class="b-add">+ ${esc(f.correction)}</div></div>
          <p>${esc(f.explanation)}</p>
        </div>`
      )
      .join("");
    const suggestion = e.suggestions
      .map(
        (s) => `
        <div class="b-thread b-thread-hint">
          <div class="b-thread-head"><span class="b-sev b-sev-hint">◆</span> <span class="b-cat">Suggestion</span><span class="b-sevname">not an error</span></div>
          <div class="b-diff"><div class="b-ctx">  ${esc(s.original)}</div><div class="b-alt">~ ${esc(s.alternative)}</div></div>
          <p>${esc(s.why)}</p>
        </div>`
      )
      .join("");
    const main = `
      <div class="b-tabs"><span class="b-tab is-on">pull-request.md <i>●</i></span><span class="b-tab">corrected.md</span><span class="b-tab-spacer"></span>
        <div class="b-kind-select">${data.textKinds.map((k) => `<button type="button" class="${k === e.textKind ? "is-on" : ""}">${k}</button>`).join("")}</div>
      </div>
      <div class="b-split">
        <section class="b-editor">
          <div class="b-title-row"><h1>${esc(e.title)}</h1><div class="b-score"><b>${e.score}</b><span>${e.band}</span></div></div>
          <div class="b-gutter-text"><div class="b-gutter">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<span>${n}</span>`).join("")}</div><p class="b-text">${text}</p></div>
          <div class="b-compose">
            <textarea placeholder="Paste a prompt, an issue or a pull request description…" rows="2"></textarea>
            <div class="b-compose-row"><label><input type="checkbox"/> practice <span>(kept out of Progress)</span></label><button type="button" class="b-run">Evaluate <kbd>Ctrl</kbd><kbd>Enter</kbd></button></div>
          </div>
          <div class="b-problems">
            <div class="b-problems-head">PROBLEMS <span>${e.findings.length}</span> <em>SUGGESTIONS <span>${e.suggestions.length}</span></em></div>
            ${e.findings.map((f) => `<div class="b-problem">${sevIcon(f.severity)} <span>${esc(f.original)} → ${esc(f.correction)}</span><em>${esc(f.category)} · Ln ${f.n < 3 ? 1 : f.n < 4 ? 2 : f.n < 5 ? 4 : 6}</em></div>`).join("")}
          </div>
        </section>
        <section class="b-review" aria-label="Review">
          <div class="b-review-head"><span class="b-avatar">g</span><div><b>grifando</b> reviewed <span>· ${e.findings.length} changes suggested</span></div></div>
          ${review}${suggestion}
        </section>
      </div>`;
    const status = `<span class="b-st-ok">● Rubric ${e.rubric}</span><span>${e.words} words</span><span>${e.findingRate} / 100 words</span><span>${e.codeSpans} code span skipped</span><span class="b-st-right">${e.textKind}</span><span>UTF-8</span>`;
    return shell(data, ctx, side, main, status);
  };

  const progress = (data, ctx) => {
    const p = data.progress;
    const max = Math.max(...p.categories.map((c) => c.count));
    const blocks = (count) => {
      const n = Math.round((count / max) * 24);
      return `<span class="b-blocks">${"█".repeat(n)}<i>${"░".repeat(24 - n)}</i></span>`;
    };
    const side = `
      <div class="b-side-head"><span>FILTERS</span></div>
      <div class="b-filter"><div class="b-filter-label">period</div>${["7d", "30d", "all"].map((x) => `<button type="button" class="${x === "30d" ? "is-on" : ""}">${x}</button>`).join("")}</div>
      <div class="b-filter"><div class="b-filter-label">text kind</div>${["all", ...data.textKinds.map((k) => k.toLowerCase())].map((x) => `<button type="button" class="${x === "all" ? "is-on" : ""}">${x}</button>`).join("")}</div>
      <div class="b-filter"><div class="b-filter-label">rubric</div><button type="button" class="is-on">1-provisional</button></div>`;
    const main = `
      <div class="b-cmd"><span class="b-prompt">~/grifando</span> <span class="b-dollar">$</span> grifando progress --period 30d --kind all</div>
      <div class="b-kpis">
        <div class="b-kpi b-kpi-main"><span>finding_rate</span><b>${p.findingRate}</b><em>per 100 English words · primary</em></div>
        <div class="b-kpi"><span>evaluations</span><b>${p.evaluations}</b><em>work texts only</em></div>
        <div class="b-kpi"><span>english_words</span><b>${p.words.toLocaleString("en")}</b><em>evaluated</em></div>
        <div class="b-kpi"><span>avg_score</span><b>${p.averageScore}</b><em>secondary</em></div>
      </div>
      <section class="b-panel">
        <div class="b-panel-head">finding_rate by day <span>${p.seriesStart} → ${p.seriesEnd} · empty days have no evaluation</span></div>
        ${lineChart(p.series, { width: 900, height: 230, labels: [p.seriesStart, p.seriesEnd], className: "b-lc" })}
      </section>
      <div class="b-grid2">
        <section class="b-panel">
          <div class="b-panel-head">error_categories <span>${p.findings} findings</span></div>
          <ul class="b-cats">${p.categories.map((c) => `<li><span class="b-cat-name">${esc(c.name)}</span>${blocks(c.count)}<b>${c.count}</b></li>`).join("")}</ul>
        </section>
        <section class="b-panel">
          <div class="b-panel-head">by text_kind</div>
          <table class="b-table"><thead><tr><th>kind</th><th>rate</th><th>evals</th></tr></thead><tbody>${p.byKind.map((k) => `<tr><td>${k.kind.toLowerCase()}</td><td>${k.rate.toFixed(1)}</td><td>${k.evaluations}</td></tr>`).join("")}</tbody></table>
          <div class="b-panel-head b-gap">insights</div>
          <ul class="b-log">${p.insights.map((i) => `<li><span class="b-info">[info]</span> ${esc(i.text)} <a>evidence ↗</a></li>`).join("")}</ul>
        </section>
      </div>`;
    const status = `<span class="b-st-ok">● Rubric 1-provisional</span><span>practice texts excluded</span><span class="b-st-right">days in your time zone</span>`;
    return shell(data, ctx, side, main, status);
  };

  const academy = (data, ctx) => {
    const a = data.academy;
    const x = a.exercise;
    const groups = ["Active", "Improving", "Mastered"];
    const side = `
      <div class="b-side-head"><span>MISTAKE PATTERNS</span></div>
      ${groups
        .map(
          (
            g
          ) => `<div class="b-tree-group">▾ ${g.toLowerCase()} <span>${a.patterns.filter((p) => p.mastery === g).length}</span></div>
          <ul class="b-tree">${a.patterns
            .filter((p) => p.mastery === g)
            .map(
              (p) =>
                `<li><span class="b-tree-dot b-m-${g.toLowerCase()}${p.fading ? " is-fading" : ""}"></span><span>${esc(p.example[0])}</span><em>${p.occurrences}×</em></li>`
            )
            .join("")}</ul>`
        )
        .join("")}`;
    const main = `
      <div class="b-tabs"><span class="b-tab is-on">exercise ${x.position}/${x.total}</span><span class="b-tab">today.md</span><span class="b-tab">explain-code</span><span class="b-tab-spacer"></span></div>
      <div class="b-academy">
        <section class="b-quiz">
          <div class="b-quiz-meta"><span class="b-pill">${esc(x.type.toLowerCase())}</span><span class="b-pill">prepositions</span><span class="b-pill">from your own writing</span></div>
          <h1>${esc(x.question)}</h1>
          <ol class="b-options">${x.options.map((o, i) => `<li><kbd>${i + 1}</kbd><span>${esc(o)}</span></li>`).join("")}</ol>
          <div class="b-quiz-foot"><span>press <kbd>1</kbd>–<kbd>4</kbd> to answer · the answer shows after your attempt</span><div class="b-progressbar"><i style="width:${((x.position - 1) / x.total) * 100}%"></i></div></div>
        </section>
        <section class="b-cards">
          <div class="b-card">
            <div class="b-card-head"># today</div>
            <h2>${esc(a.challenge.title)}</h2>
            <p>${esc(a.challenge.prompt)}</p>
            <div class="b-card-foot"><span>focus: ${esc(a.challenge.focus.toLowerCase())}</span><button type="button" class="b-run">Start</button></div>
          </div>
          <div class="b-card">
            <div class="b-card-head"># practice</div>
            <ul class="b-palette">${a.practice.map((p) => `<li class="${p.muted ? "is-muted" : ""}"><span class="b-chev">›</span><b>${esc(p.name.toLowerCase())}</b><em>${esc(p.detail)}</em></li>`).join("")}</ul>
          </div>
          <div class="b-card">
            <div class="b-card-head"># weak categories</div>
            <div class="b-weak">${a.weak.map((w) => `<span>${esc(w.toLowerCase())}</span>`).join("")}</div>
          </div>
        </section>
      </div>`;
    const status = `<span class="b-st-ok">● 8 exercises ready</span><span>2 patterns active</span><span class="b-st-right">academy</span>`;
    return shell(data, ctx, side, main, status);
  };

  window.VARIANTS.B = {
    name: "Terminal",
    render: (screen, data, ctx) =>
      ({ desk, progress, academy })[screen](data, ctx),
  };
})();
