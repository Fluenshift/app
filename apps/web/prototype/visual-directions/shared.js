// PROTOTYPE (#333), throwaway: the variant router, the floating switcher and small helpers.
// Four visual directions of the same three screens, chosen by ?variant=A..D&screen=desk|progress|academy.
(function () {
  const VARIANTS = (window.VARIANTS = window.VARIANTS || {});
  const SCREENS = [
    { key: "desk", label: "Write" },
    { key: "progress", label: "Progress" },
    { key: "academy", label: "Academy" },
  ];

  const esc = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  // Renders the Writing Sample's segments with one callback per kind of span.
  const segments = (evaluation, render) =>
    evaluation.segments
      .map((segment) => {
        if (segment.code) return render.code(segment.code);
        if (segment.f)
          return render.finding(segment.t, evaluation.findings[segment.f - 1]);
        if (segment.s)
          return render.suggestion(
            segment.t,
            evaluation.suggestions[segment.s - 1]
          );
        return esc(segment.t);
      })
      .join("");

  // A line chart with gaps where a bucket is empty (PC-02). Returns an SVG string.
  const lineChart = (series, options = {}) => {
    const width = options.width ?? 640;
    const height = options.height ?? 200;
    const pad = options.pad ?? { top: 16, right: 16, bottom: 24, left: 32 };
    const max = options.max ?? 8;
    const ticks = options.ticks ?? [0, 2, 4, 6, 8];
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const x = (i) => pad.left + (innerW * i) / (series.length - 1);
    const y = (v) => pad.top + innerH - (innerH * v) / max;
    const runs = [];
    let run = [];
    series.forEach((value, i) => {
      if (value === null) {
        if (run.length) runs.push(run);
        run = [];
      } else run.push([x(i), y(value), value, i]);
    });
    if (run.length) runs.push(run);
    const points = runs.flat();
    const path = points
      .map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`)
      .join(" ");
    const area =
      points.length > 1
        ? `${path} L${points.at(-1)[0].toFixed(1)},${(pad.top + innerH).toFixed(1)} L${points[0][0].toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`
        : "";
    const grid = ticks
      .map(
        (t) =>
          `<line class="lc-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(t)}" y2="${y(t)}"/>` +
          `<text class="lc-tick" x="${pad.left - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`
      )
      .join("");
    const empties = series
      .map((value, i) =>
        value === null
          ? `<line class="lc-empty" x1="${x(i)}" x2="${x(i)}" y1="${pad.top + innerH - 3}" y2="${pad.top + innerH + 3}"/>`
          : ""
      )
      .join("");
    const dots = points
      .map(
        ([px, py, value]) =>
          `<circle class="lc-dot" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${options.dot ?? 3.2}"><title>${value} per 100 words</title></circle>`
      )
      .join("");
    const labels = options.labels
      ? `<text class="lc-tick" x="${pad.left}" y="${height - 4}">${esc(options.labels[0])}</text><text class="lc-tick" x="${width - pad.right}" y="${height - 4}" text-anchor="end">${esc(options.labels[1])}</text>`
      : "";
    return `<svg class="lc ${options.className ?? ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Finding Rate per day">${grid}${empties}${area ? `<path class="lc-area" d="${area}"/>` : ""}<path class="lc-line" d="${path}"/>${dots}${labels}</svg>`;
  };

  // A circular gauge for a 0 to 100 score.
  const ring = (score, size = 132, stroke = 12) => {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true"><circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/><circle class="ring-value" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${((c * score) / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  };

  const params = () => new URLSearchParams(location.search);
  const keys = () => Object.keys(VARIANTS).sort();
  const current = () => {
    const p = params();
    const variant = keys().includes(p.get("variant"))
      ? p.get("variant")
      : keys()[0];
    const screen = SCREENS.some((s) => s.key === p.get("screen"))
      ? p.get("screen")
      : "desk";
    return { variant, screen };
  };
  const hrefFor = (variant, screen) => `?variant=${variant}&screen=${screen}`;

  const go = (variant, screen) => {
    history.replaceState(null, "", hrefFor(variant, screen));
    render();
  };

  const switcher = ({ variant, screen }) => {
    const list = keys();
    const index = list.indexOf(variant);
    const prev = list[(index - 1 + list.length) % list.length];
    const next = list[(index + 1) % list.length];
    return `<div class="proto-bar" role="toolbar" aria-label="Prototype switcher">
      <span class="proto-tag">Prototype</span>
      <button type="button" data-go="${prev}|${screen}" aria-label="Previous direction">‹</button>
      <span class="proto-name"><b>${variant}</b> ${esc(VARIANTS[variant].name)}</span>
      <button type="button" data-go="${next}|${screen}" aria-label="Next direction">›</button>
      <span class="proto-sep"></span>
      ${SCREENS.map((s, i) => `<button type="button" class="proto-screen${s.key === screen ? " is-on" : ""}" data-go="${variant}|${s.key}" title="Key ${i + 1}">${s.label}</button>`).join("")}
    </div>`;
  };

  const render = () => {
    const state = current();
    const variant = VARIANTS[state.variant];
    document.documentElement.dataset.variant = state.variant;
    document.title = `Grifando prototype: ${state.variant} ${variant.name}`;
    const app = document.getElementById("app");
    app.className = `v v-${state.variant.toLowerCase()}`;
    app.innerHTML = variant.render(state.screen, window.GRIFANDO_DATA, {
      href: (screen) => hrefFor(state.variant, screen),
      screen: state.screen,
    });
    document.getElementById("proto").innerHTML = switcher(state);
    window.scrollTo(0, 0);
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-go]");
    if (button) {
      const [variant, screen] = button.dataset.go.split("|");
      go(variant, screen);
      return;
    }
    const link = event.target.closest("a[href^='?']");
    if (link) {
      event.preventDefault();
      const p = new URLSearchParams(link.getAttribute("href"));
      go(p.get("variant"), p.get("screen"));
    }
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target.closest?.("input, textarea, select, [contenteditable]")) return;
    const { variant, screen } = current();
    const list = keys();
    const index = list.indexOf(variant);
    if (event.key === "ArrowRight") go(list[(index + 1) % list.length], screen);
    if (event.key === "ArrowLeft")
      go(list[(index - 1 + list.length) % list.length], screen);
    const n = Number(event.key);
    if (n >= 1 && n <= SCREENS.length) go(variant, SCREENS[n - 1].key);
  });

  window.addEventListener("popstate", render);
  window.PROTO = { esc, segments, lineChart, ring, render };
})();
