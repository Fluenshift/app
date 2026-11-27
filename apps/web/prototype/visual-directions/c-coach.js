// PROTOTYPE (#333), throwaway. Direction C, "Coach": a bright, friendly consumer product. One thing
// at a time, big type, rounded cards, plain words. No game elements: those wait (ADR 0046).
(function () {
  const { esc, segments, lineChart, ring } = window.PROTO;

  const kindIcon = {
    Prompt: '<path d="M5 6h14v9H9l-4 3V6z"/><path d="M9 10h6"/>',
    Issue:
      '<circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><path d="M12 16h.01"/>',
    "Pull request":
      '<circle cx="7" cy="6" r="2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M7 8v8"/><path d="M17 16V9a3 3 0 0 0-3-3h-3"/>',
    Other: '<path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h6"/>',
  };
  const svg = (paths, size = 22) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const header = (data, ctx) => `
    <header class="c-top">
      <a class="c-logo" href="${ctx.href("desk")}"><span class="c-blob"></span>grifando</a>
      <nav class="c-nav" aria-label="Primary">
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
      code: (code) => `<code class="c-code">${esc(code)}</code>`,
      finding: (t, f) => `<span class="c-mark">${esc(t)}<b>${f.n}</b></span>`,
      suggestion: (t) =>
        `<span class="c-mark c-mark-idea">${esc(t)}<b>?</b></span>`,
    });
    return `
    ${header(data, ctx)}
    <main class="c-wrap">
      <section class="c-hero">
        <h1>Check your English</h1>
        <p>Paste something you wrote for work. Grifando reads the English only, never the code.</p>
      </section>
      <section class="c-card c-compose">
        <div class="c-kinds" role="radiogroup" aria-label="What is it?">
          ${data.textKinds
            .map(
              (k) =>
                `<button type="button" role="radio" aria-checked="${k === e.textKind}" class="c-kind${k === e.textKind ? " is-on" : ""}">${svg(kindIcon[k])}<span>${k}</span></button>`
            )
            .join("")}
        </div>
        <textarea rows="4" placeholder="Paste your text here…"></textarea>
        <div class="c-compose-row">
          <label class="c-toggle"><input type="checkbox"/><span class="c-switch"></span>Just practicing <em>(stays out of Progress)</em></label>
          <button type="button" class="c-btn">Check my English</button>
        </div>
      </section>

      <section class="c-card c-result">
        <div class="c-score">
          ${ring(e.score)}
          <div class="c-score-num"><b>${e.score}</b><span>${e.band}</span></div>
        </div>
        <div class="c-result-text">
          <div class="c-chip-row"><span class="c-chip">${esc(e.textKind)}</span><span class="c-chip">${e.words} words</span><span class="c-chip">${e.findingRate} per 100 words</span></div>
          <h2>Clear, with ${e.findings.length} things to fix</h2>
          <p>Your reader gets the message. Fix these five and it reads naturally. One more idea is optional.</p>
        </div>
      </section>

      <section class="c-card c-text-card">
        <p class="c-text">${text}</p>
      </section>

      <section class="c-fixes">
        ${e.findings
          .map(
            (f) => `
          <article class="c-card c-fix">
            <div class="c-fix-num">${f.n}</div>
            <div class="c-fix-body">
              <div class="c-fix-change"><span class="c-old">${esc(f.original)}</span><span class="c-arrow">→</span><span class="c-new">${esc(f.correction)}</span></div>
              <p>${esc(f.explanation)}</p>
              <div class="c-chip-row"><span class="c-chip">${esc(f.category)}</span><span class="c-chip c-sev-${f.severity.toLowerCase()}">${f.severity}</span>${f.l1 ? `<span class="c-chip c-chip-pt">Comes from Portuguese</span>` : ""}</div>
            </div>
          </article>`
          )
          .join("")}
        ${e.suggestions
          .map(
            (s) => `
          <article class="c-card c-fix c-idea">
            <div class="c-fix-num">?</div>
            <div class="c-fix-body">
              <div class="c-fix-change"><span>${esc(s.original)}</span><span class="c-arrow">→</span><span class="c-new c-new-idea">${esc(s.alternative)}</span></div>
              <p>${esc(s.why)}</p>
              <div class="c-chip-row"><span class="c-chip c-chip-idea">Optional idea, not an error</span></div>
            </div>
          </article>`
          )
          .join("")}
      </section>
    </main>`;
  };

  const progress = (data, ctx) => {
    const p = data.progress;
    const max = Math.max(...p.categories.map((c) => c.count));
    const colors = [
      "coral",
      "sun",
      "sky",
      "mint",
      "grape",
      "coral",
      "sun",
      "sky",
    ];
    const kindMax = Math.max(...p.byKind.map((k) => k.rate));
    return `
    ${header(data, ctx)}
    <main class="c-wrap c-wrap-wide">
      <section class="c-hero c-hero-row">
        <div><h1>Your English this month</h1><p>Only real work texts count here. Practice stays out.</p></div>
        <div class="c-seg">${["7 days", "30 days", "All time"].map((x) => `<button type="button" class="${x === "30 days" ? "is-on" : ""}">${x}</button>`).join("")}</div>
      </section>
      <section class="c-stats">
        <div class="c-stat c-stat-main"><b>${p.findingRate}</b><span>mistakes per 100 words</span><em>the number that matters most</em></div>
        <div class="c-stat"><b>${p.evaluations}</b><span>texts checked</span></div>
        <div class="c-stat"><b>${p.words.toLocaleString("en")}</b><span>English words</span></div>
        <div class="c-stat"><b>${p.averageScore}</b><span>average score</span></div>
      </section>
      <section class="c-card c-chart">
        <h2>Day by day</h2>
        <p class="c-muted">Mistakes per 100 words on each day you wrote. Gaps are days without texts.</p>
        ${lineChart(p.series, { width: 900, height: 240, labels: [p.seriesStart, p.seriesEnd], className: "c-lc", dot: 4.5 })}
      </section>
      <div class="c-grid2">
        <section class="c-card">
          <h2>What trips you up</h2>
          <ul class="c-bars">${p.categories.map((c, i) => `<li><span>${esc(c.name)}</span><span class="c-bar"><i class="c-${colors[i]}" style="width:${((c.count / max) * 100).toFixed(1)}%"></i></span><b>${c.count}</b></li>`).join("")}</ul>
        </section>
        <section class="c-card">
          <h2>By kind of text</h2>
          <div class="c-kinds-cmp">${p.byKind
            .map(
              (k) =>
                `<div class="c-kind-cmp">${svg(kindIcon[k.kind], 20)}<span>${k.kind}</span><div class="c-mini"><i style="height:${((k.rate / kindMax) * 100).toFixed(0)}%"></i></div><b>${k.rate}</b><em>${k.evaluations} texts</em></div>`
            )
            .join("")}</div>
          <h2 class="c-gap">Worth knowing</h2>
          <div class="c-bubbles">${p.insights.map((i) => `<div class="c-bubble">${esc(i.text)} <a>Show me</a></div>`).join("")}</div>
        </section>
      </div>
    </main>`;
  };

  const academy = (data, ctx) => {
    const a = data.academy;
    const x = a.exercise;
    const steps = { Active: 1, Improving: 2, Mastered: 3 };
    const tiles = {
      exercises: "grape",
      explain: "sky",
      technical: "mint",
      interview: "mute",
    };
    const tileIcon = {
      exercises:
        '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11"/>',
      explain: '<path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/>',
      technical:
        '<rect x="4" y="4" width="16" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
      interview: '<path d="M4 5h16v10H8l-4 4V5z"/>',
    };
    return `
    ${header(data, ctx)}
    <main class="c-wrap c-wrap-wide">
      <div class="c-academy">
        <div class="c-col">
          <section class="c-card c-lesson">
            <div class="c-steps"><span class="is-done">1 Write</span><span class="is-on">2 Practice</span><span>3 Done</span></div>
            <div class="c-eyebrow">Today's practice · ${esc(a.challenge.title)}</div>
            <h1>${esc(x.question)}</h1>
            <div class="c-options">${x.options.map((o) => `<button type="button" class="c-option">${esc(o)}</button>`).join("")}</div>
            <div class="c-lesson-foot"><div class="c-dots">${Array.from({ length: x.total }, (_, i) => `<i class="${i < x.position - 1 ? "is-done" : i === x.position - 1 ? "is-on" : ""}"></i>`).join("")}</div><button type="button" class="c-btn" disabled>Check</button></div>
          </section>
          <section class="c-tiles">
            ${a.practice
              .map(
                (p) =>
                  `<button type="button" class="c-tile c-tile-${tiles[p.key]}" ${p.muted ? "disabled" : ""}><span class="c-tile-icon">${svg(tileIcon[p.key], 24)}</span><b>${esc(p.name)}</b><em>${esc(p.detail)}</em></button>`
              )
              .join("")}
          </section>
        </div>
        <section class="c-card c-patterns">
          <h2>Your mistakes, one by one</h2>
          <p class="c-muted">The same mistake shows up once, however often you make it.</p>
          <ul>${a.patterns
            .map(
              (p) => `<li>
                <div class="c-meter" aria-label="${p.mastery}">${[1, 2, 3].map((n) => `<i class="${n <= steps[p.mastery] ? "is-on" : ""} c-meter-${p.mastery.toLowerCase()}"></i>`).join("")}</div>
                <div><div class="c-pat"><span class="c-old">${esc(p.example[0])}</span> → <span class="c-new">${esc(p.example[1])}</span></div>
                <div class="c-muted c-small">${esc(p.category)} · ${p.occurrences} times${p.l1 ? " · from Portuguese" : ""}</div></div>
                <span class="c-badge c-badge-${p.mastery.toLowerCase()}">${p.fading ? "Review soon" : p.mastery}</span>
              </li>`
            )
            .join("")}</ul>
        </section>
      </div>
    </main>`;
  };

  window.VARIANTS.C = {
    name: "Coach",
    render: (screen, data, ctx) =>
      ({ desk, progress, academy })[screen](data, ctx),
  };
})();
