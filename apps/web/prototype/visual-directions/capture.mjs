// PROTOTYPE (#333), throwaway: screenshots and checks of the visual directions.
//
// Usage, from the repository root (Playwright comes from the root's devDependencies):
//   node apps/web/prototype/visual-directions/capture.mjs            screenshots of every direction
//   node apps/web/prototype/visual-directions/capture.mjs A E        only these directions
//   node apps/web/prototype/visual-directions/capture.mjs --check    no screenshots: report text
//                                                                     below WCAG contrast and
//                                                                     likely English UI strings
//
// It serves this folder itself on a free loopback port, hides the switcher bar, and writes
// screenshots/<variant>-<screen>.png at 1440 px wide (full page) and <variant>-desk-mobile.png
// at 390 px wide. Fonts come from Google Fonts, so the capture needs the network.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL(".", import.meta.url));
const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args.filter((a) => /^[A-Z]$/.test(a));
const variants = only.length ? only : ["A", "C", "D", "E"];
const screens = ["desk", "progress", "academy", "practice"];
// E aims at AAA for body text (7:1); the others at AA (4.5:1). Large text needs 3:1 or 4.5:1.
const aaa = new Set(["E"]);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = join(root, path.endsWith("/") ? `${path}index.html` : path);
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const hide = "#proto { display: none !important; } #app { padding-bottom: 0 !important; }";

// Runs in the page: every element with its own text, its color against the first opaque
// background behind it, and the WCAG threshold its size needs.
const contrastScan = (strict) => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 };
  };
  const lum = ({ r, g, b }) =>
    [r, g, b]
      .map((v) => v / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const blend = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const background = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
    }
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (const layer of layers.reverse()) bg = blend(layer, bg);
    return bg;
  };
  const out = [];
  const walker = document.createTreeWalker(document.getElementById("app"), NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!t.textContent.trim() || seen.has(el) || el.closest("svg, [aria-hidden='true'], details:not([open]) > :not(summary)")) continue;
    seen.add(el);
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    if (el.closest(".sr-only")) continue;
    const fg = parse(s.color);
    const bg = background(el);
    const color = fg.a < 1 ? blend(fg, bg) : fg;
    const [l1, l2] = [lum(color), lum(bg)].sort((a, b) => b - a);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const size = parseFloat(s.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700);
    const need = strict ? (large ? 4.5 : 7) : large ? 3 : 4.5;
    if (ratio + 0.005 < need)
      out.push({
        text: t.textContent.trim().slice(0, 50),
        ratio: Math.round(ratio * 100) / 100,
        need,
        cls: `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`,
      });
  }
  return out;
};

// Runs in the page: words that look English in text outside lang="en".
const englishScan = () => {
  // Letters on either side end a match, accented ones included ("período" is not "per").
  // "Natural" is left out: it is the same word in Portuguese, and a Proficiency Band.
  const words =
    /(?<!\p{L})(the|and|of|to|your|you|with|for|this|that|is|are|not|write|progress|academy|findings?|score|suggestions?|evaluate|evaluation|practice|settings|history|today|exercises?|patterns?|mastery|active|improving|mastered|minor|moderate|major|clear|understandable|needs|other|words|per|days|check|next|answer|correct|wrong|review|corrected|version|provisional|category|categories|rate|average|insights?|evidence|new|delete|copy)(?!\p{L})/iu;
  const out = [];
  const walker = document.createTreeWalker(document.getElementById("app"), NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    const text = t.textContent.trim();
    if (!text || el.closest("[lang='en'], code, script, style")) continue;
    if (words.test(text)) out.push(text.slice(0, 80));
  }
  const attrs = [...document.querySelectorAll("#app [aria-label], #app [title], #app [placeholder]")]
    .flatMap((el) => ["aria-label", "title", "placeholder"].map((a) => el.getAttribute(a)))
    .filter((v) => v && words.test(v));
  return [...new Set([...out, ...attrs])];
};

// Runs in the page: the sample data agrees with RUBRIC.md and with itself, so every direction
// shows the same, coherent numbers.
const dataScan = () => {
  const d = window.GRIFANDO_DATA;
  const out = [];
  const expect = (ok, message) => ok || out.push(message);
  const round1 = (v) => Math.round(v * 10) / 10;
  const e = d.evaluation;
  const points = { Leve: 3, Moderada: 7, Grave: 12 };
  const errorPoints = e.findings.reduce((s, f) => s + points[f.severity], 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - (100 * errorPoints) / Math.max(e.words, 20))));
  expect(score === e.score, `score ${e.score}, the rubric gives ${score}`);
  const band = d.bands.find((b) => score >= b.from && score <= b.to).name;
  expect(band === e.band, `band ${e.band}, the rubric gives ${band}`);
  expect(round1((e.findings.length / e.words) * 100) === e.findingRate, "the Evaluation's Finding Rate");
  const p = d.progress;
  const days = p.daily.filter(Boolean);
  expect(days.reduce((s, r) => s + r[0], 0) === p.evaluations, "Evaluations per day add up");
  expect(days.reduce((s, r) => s + r[1], 0) === p.words, "words per day add up");
  expect(days.reduce((s, r) => s + r[2], 0) === p.findings, "Findings per day add up");
  expect(round1((p.findings / p.words) * 100) === p.findingRate, "the period's Finding Rate");
  expect(p.byKind.reduce((s, k) => s + k.evaluations, 0) === p.evaluations, "Evaluations per Text Kind add up");
  expect(p.categories.reduce((s, c) => s + c.count, 0) === p.findings, "category counts add up");
  p.series.forEach((v, i) => {
    const row = p.daily[i];
    expect((v === null) === (row === null), `day ${p.days[i]}: series and daily rows agree on empty days`);
    if (row) expect(round1((row[2] / row[1]) * 100) === v, `day ${p.days[i]}: Finding Rate ${v}`);
    const perDay = p.categories.map((c) => c.series[i]);
    if (row) expect(perDay.reduce((s, x) => s + x, 0) === row[2], `day ${p.days[i]}: categories add up`);
    else expect(perDay.every((x) => x === null), `day ${p.days[i]}: empty in every category`);
  });
  p.categories.forEach((c) =>
    expect(c.series.reduce((s, x) => s + (x ?? 0), 0) === c.count, `${c.name}: its days add up to ${c.count}`)
  );
  const today = p.categories.map((c) => c.series.at(-1));
  const fromFindings = p.categories.map((c) => e.findings.filter((f) => f.category === c.name).length);
  expect(today.join() === fromFindings.join(), "today's categories match the Evaluation's Findings");
  return out;
};

const browser = await chromium.launch();
let failures = 0;
try {
  if (check) {
    const page = await browser.newPage();
    await page.goto(base, { waitUntil: "domcontentloaded" });
    const problems = await page.evaluate(dataScan);
    for (const problem of problems) console.log(`data: ${problem}`);
    failures += problems.length;
    await page.close();
  }
  const shots = [
    ...variants.flatMap((v) => screens.map((s) => ({ v, s, width: 1440, name: `${v}-${s}` }))),
    ...variants.map((v) => ({ v, s: "desk", width: 390, name: `${v}-desk-mobile`, mobile: true })),
  ];
  for (const shot of shots) {
    const page = await browser.newPage({
      viewport: { width: shot.width, height: shot.mobile ? 844 : 900 },
      deviceScaleFactor: shot.mobile ? 2 : 1,
      isMobile: Boolean(shot.mobile),
      hasTouch: Boolean(shot.mobile),
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}?variant=${shot.v}&screen=${shot.s}`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: hide });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    if (errors.length) {
      failures++;
      console.log(`${shot.name}: page error ${errors.join("; ")}`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) {
      failures++;
      console.log(`${shot.name}: the page is ${overflow}px wider than the viewport`);
    }
    if (check) {
      const low = await page.evaluate(contrastScan, aaa.has(shot.v));
      for (const item of low) console.log(`${shot.name}: contrast ${item.ratio} < ${item.need} ${item.cls} "${item.text}"`);
      failures += low.length;
      if (!shot.mobile) {
        const english = await page.evaluate(englishScan);
        for (const text of english) console.log(`${shot.name}: English? "${text}"`);
      }
    } else {
      await page.screenshot({ path: join(root, "screenshots", `${shot.name}.png`), fullPage: true });
      console.log(`screenshots/${shot.name}.png`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
process.exitCode = failures ? 1 : 0;
