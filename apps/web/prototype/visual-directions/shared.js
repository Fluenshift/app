// PROTOTYPE (#333), throwaway: the variant router, the floating switcher and small helpers.
// Four visual directions of the same four screens, chosen by
// ?variant=A|C|D|E&screen=desk|progress|academy|practice. The interface speaks pt-BR (ADR 0048).
(function () {
  const VARIANTS = (window.VARIANTS = window.VARIANTS || {});
  const SCREENS = [
    { key: "desk", label: "Escrever" },
    { key: "progress", label: "Progresso" },
    { key: "academy", label: "Treino" },
    { key: "practice", label: "Exercício" },
  ];

  const esc = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  // Numbers in pt-BR: a decimal comma and a dot for thousands (4,8 and 3.912).
  const num = (value, digits = 1) =>
    Number(value).toLocaleString("pt-BR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const int = (value) => Number(value).toLocaleString("pt-BR");

  // Portuguese prose with English inside: *depend on* becomes <em lang="en">depend on</em>.
  const rich = (text, className = "en") =>
    esc(text).replace(
      /\*([^*]+)\*/g,
      `<em lang="en" class="${className}">$1</em>`
    );

  // A Finding Severity as a level from 1 to 3, for shapes and meters that do not rely on color.
  const level = (severity) =>
    ({ Leve: 1, Moderada: 2, Grave: 3 })[severity] ?? 1;

  // A CSS-safe slug: "Forma/tempo verbal" becomes "forma-tempo-verbal".
  const slug = (value) =>
    String(value)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

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

  // The corrected version, with `code` spans rendered by the caller.
  const corrected = (text, code) =>
    esc(text).replace(/`([^`]+)`/g, (_, c) => code(c));

  // The Proficiency Band that holds a score.
  const bandOf = (bands, score) =>
    bands.find((b) => score >= b.from && score <= b.to);

  // A line chart with gaps where a bucket is empty (PC-02). Returns an SVG string.
  let chartCount = 0;
  const lineChart = (series, options = {}) => {
    const width = options.width ?? 640;
    const height = options.height ?? 200;
    const pad = options.pad ?? { top: 16, right: 16, bottom: 24, left: 32 };
    const max = options.max ?? 8;
    const ticks = options.ticks ?? [0, 2, 4, 6, 8];
    const days = options.days ?? [];
    const innerW = width - pad.left - pad.right;
    const innerH = height - pad.top - pad.bottom;
    const x = (i) => pad.left + (innerW * i) / (series.length - 1);
    const y = (v) => pad.top + innerH - (innerH * v) / max;
    // Consecutive days form a run, drawn solid; an empty day breaks the line, and a faint
    // dotted bridge joins the runs so the eye still follows the period.
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
    const pt = ([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`;
    const path = runs
      .map((r) => r.map((p, i) => `${i ? "L" : "M"}${pt(p)}`).join(" "))
      .join(" ");
    const bridges = runs
      .slice(1)
      .map((r, i) => `M${pt(runs[i].at(-1))} L${pt(r[0])}`)
      .join(" ");
    const outline = points
      .map((p, i) => `${i ? "L" : "M"}${pt(p)}`)
      .join(" ");
    const area =
      points.length > 1
        ? `${outline} L${points.at(-1)[0].toFixed(1)},${(pad.top + innerH).toFixed(1)} L${points[0][0].toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`
        : "";
    const grid = ticks
      .map(
        (t) =>
          `<line class="lc-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y(t)}" y2="${y(t)}"/>` +
          `<text class="lc-tick" x="${pad.left - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`
      )
      .join("");
    const slot = innerW / (series.length - 1);
    // A day with no Evaluation can be a hatched band, so it reads as "no data" without color.
    const hatchId = `lc-hatch-${(chartCount += 1)}`;
    const hatch = options.emptyBand
      ? `<defs><pattern id="${hatchId}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect class="lc-hatch-bg" width="6" height="6"/><line class="lc-hatch" x1="1" y1="0" x2="1" y2="6"/></pattern></defs>`
      : "";
    const empties = series
      .map((value, i) =>
        value === null
          ? options.emptyBand
            ? `<rect class="lc-empty-band" fill="url(#${hatchId})" x="${(x(i) - slot / 2).toFixed(1)}" y="${pad.top}" width="${slot.toFixed(1)}" height="${innerH}"><title>${esc(days[i] ?? "")}: sem avaliação</title></rect>`
            : `<line class="lc-empty" x1="${x(i)}" x2="${x(i)}" y1="${pad.top + innerH - 3}" y2="${pad.top + innerH + 3}"/>`
          : ""
      )
      .join("");
    const r = options.dot ?? 3.2;
    const dots = points
      .map(([px, py, value, i]) => {
        const title = `<title>${days[i] ? `${esc(days[i])}: ` : ""}${num(value)} erros por 100 palavras</title>`;
        return options.square
          ? `<rect class="lc-dot" x="${(px - r).toFixed(1)}" y="${(py - r).toFixed(1)}" width="${2 * r}" height="${2 * r}">${title}</rect>`
          : `<circle class="lc-dot" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}">${title}</circle>`;
      })
      .join("");
    const last = points.at(-1);
    const lastLabel =
      options.lastLabel && last
        ? `<text class="lc-last" x="${(last[0] - 10).toFixed(1)}" y="${(last[1] - 12).toFixed(1)}" text-anchor="end">${esc(options.lastLabel)}</text>`
        : "";
    const labels = options.labels
      ? `<text class="lc-tick" x="${pad.left}" y="${height - 4}">${esc(options.labels[0])}</text><text class="lc-tick" x="${width - pad.right}" y="${height - 4}" text-anchor="end">${esc(options.labels[1])}</text>`
      : "";
    return `<svg class="lc ${options.className ?? ""}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(options.label ?? "Taxa de erros por dia")}">${hatch}${empties}${grid}${area && !options.noArea ? `<path class="lc-area" d="${area}"/>` : ""}${bridges ? `<path class="lc-bridge" d="${bridges}"/>` : ""}<path class="lc-line" d="${path}"/>${dots}${lastLabel}${labels}</svg>`;
  };

  // Small bars for one Error Category over the period: an empty day gets a short tick, not a bar.
  const miniBars = (values, options = {}) => {
    const width = options.width ?? 240;
    const height = options.height ?? 56;
    const max = options.max ?? Math.max(1, ...values.map((v) => v ?? 0));
    const gap = options.gap ?? 2;
    const slot = width / values.length;
    const days = options.days ?? [];
    const bars = values
      .map((v, i) => {
        const x = (i * slot + gap / 2).toFixed(1);
        const w = Math.max(1, slot - gap).toFixed(1);
        if (v === null)
          return `<rect class="mb-empty" x="${x}" y="${height - 2}" width="${w}" height="2"><title>${esc(days[i] ?? "")}: sem avaliação</title></rect>`;
        const h = v === 0 ? 0 : Math.max(3, (height - 4) * (v / max));
        return `<rect class="mb-bar${v === 0 ? " is-zero" : ""}" x="${x}" y="${(height - h).toFixed(1)}" width="${w}" height="${h.toFixed(1)}"><title>${esc(days[i] ?? "")}: ${v} ${v === 1 ? "erro" : "erros"}</title></rect>`;
      })
      .join("");
    return `<svg class="mb ${options.className ?? ""}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><line class="mb-base" x1="0" x2="${width}" y1="${height - 0.5}" y2="${height - 0.5}"/>${bars}</svg>`;
  };

  // Sums of a daily series in the period's first and last seven days, for text equivalents.
  const firstLast = (values) => {
    const sum = (list) => list.reduce((s, v) => s + (v ?? 0), 0);
    return { first: sum(values.slice(0, 7)), last: sum(values.slice(-7)) };
  };

  // Weekly sums of a daily series: four whole weeks and the partial one at the end.
  const weekly = (values) =>
    [0, 1, 2, 3, 4].map((w) =>
      values.slice(w * 7, w * 7 + 7).reduce((s, v) => s + (v ?? 0), 0)
    );

  // A plain table, the text equivalent of a chart (PC-06).
  const table = (caption, head, rows, className = "") =>
    `<table class="data-table ${className}"><caption>${esc(caption)}</caption><thead><tr>${head.map((h, i) => `<th scope="col"${i ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell, i) => (i ? `<td class="num">${cell}</td>` : `<th scope="row">${cell}</th>`)).join("")}</tr>`).join("")}</tbody></table>`;

  const rateTable = (p) =>
    table(
      "Taxa de erros por dia",
      ["Dia", "Erros por 100 palavras", "Avaliações"],
      p.series.map((v, i) => [
        esc(p.days[i]),
        v === null ? "sem avaliação" : num(v),
        v === null ? "0" : String(p.daily[i][0]),
      ])
    );

  const categoryTable = (p) =>
    table(
      "Erros por categoria, semana a semana",
      ["Categoria", ...p.weeks, "Total"],
      p.categories.map((c) => [
        esc(c.name),
        ...weekly(c.series).map(String),
        String(c.count),
      ])
    );

  const kindTable = (p) =>
    table(
      "Taxa de erros por tipo de texto",
      ["Tipo de texto", "Erros por 100 palavras", "Avaliações"],
      p.byKind.map((k) => [esc(k.kind), num(k.rate), String(k.evaluations)])
    );

  // The trend's summary sentence: values only, never "improved" or "declined" (RUBRIC.md).
  const rateSummary = (p) => {
    const values = p.series
      .map((v, i) => [v, i])
      .filter(([v]) => v !== null);
    const low = values.reduce((a, b) => (b[0] < a[0] ? b : a));
    const high = values.reduce((a, b) => (b[0] > a[0] ? b : a));
    return `${values.length} dias com avaliações e ${p.series.length - values.length} sem. A taxa foi de ${num(low[0])} (${p.days[low[1]]}) a ${num(high[0])} (${p.days[high[1]]}); hoje, ${num(p.series.at(-1))}.`;
  };

  const categorySummary = (p) =>
    p.categories
      .slice(0, 3)
      .map((c) => {
        const { first, last } = firstLast(c.series);
        return `${c.name}: ${first} nos primeiros 7 dias, ${last} nos últimos 7`;
      })
      .join("; ") + ".";

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
    const v = VARIANTS[variant];
    return `<div class="proto-bar" role="toolbar" aria-label="Seletor do protótipo">
      <p class="proto-caption"><b>${variant} · ${esc(v.name)}</b> ${esc(v.tagline)}</p>
      <div class="proto-row">
        <span class="proto-tag">Protótipo</span>
        <button type="button" data-go="${prev}|${screen}" aria-label="Direção anterior">‹</button>
        <span class="proto-name"><b>${variant}</b> ${esc(v.name)}</span>
        <button type="button" data-go="${next}|${screen}" aria-label="Próxima direção">›</button>
        <span class="proto-sep"></span>
        <span class="proto-screens">${SCREENS.map((s, i) => `<button type="button" class="proto-screen${s.key === screen ? " is-on" : ""}" data-go="${variant}|${s.key}" title="Tecla ${i + 1}" aria-pressed="${s.key === screen}">${s.label}</button>`).join("")}</span>
      </div>
    </div>`;
  };

  const render = () => {
    const state = current();
    const variant = VARIANTS[state.variant];
    document.documentElement.dataset.variant = state.variant;
    document.documentElement.dataset.screen = state.screen;
    document.title = `Protótipo do Grifando: ${state.variant} ${variant.name}`;
    const app = document.getElementById("app");
    app.className = `v v-${state.variant.toLowerCase()} s-${state.screen}`;
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
      return;
    }
    // A radio group of buttons (the Text Kind, the period) moves its choice on click.
    const radio = event.target.closest("[role='radio']");
    const group = radio?.closest("[role='radiogroup']");
    if (radio && group) {
      group.querySelectorAll("[role='radio']").forEach((r) => {
        r.setAttribute("aria-checked", String(r === radio));
        r.classList.toggle("is-on", r === radio);
      });
    }
  });

  // Hovering or focusing a Finding's mark lights its note, and the other way round.
  const link = (event, on) => {
    const el = event.target.closest?.("[data-link]");
    if (!el) return;
    document
      .querySelectorAll(`[data-link="${el.dataset.link}"]`)
      .forEach((x) => x.classList.toggle("is-linked", on));
  };
  document.addEventListener("mouseover", (event) => link(event, true));
  document.addEventListener("mouseout", (event) => link(event, false));
  document.addEventListener("focusin", (event) => link(event, true));
  document.addEventListener("focusout", (event) => link(event, false));

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (target.closest?.("input, textarea, select, [contenteditable]")) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
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
  window.PROTO = {
    esc,
    num,
    int,
    rich,
    level,
    slug,
    segments,
    corrected,
    bandOf,
    lineChart,
    miniBars,
    firstLast,
    weekly,
    table,
    rateTable,
    categoryTable,
    kindTable,
    rateSummary,
    categorySummary,
    ring,
    render,
  };
})();
