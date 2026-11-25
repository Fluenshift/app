// Grifando's link preview, the metadata of src/app/layout.tsx and the card of
// src/app/opengraph-image.tsx (74dbb9f). The shell carries the metadata from the build; the
// hosted profile adds the card's tags at the public origin SITE_URL names, which no build can
// know, and serves the card outside the session, as Grifando's proxy matcher left
// `opengraph-image` (docs/adr/0040). The local profile, on loopback only, adds neither.
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ServerConfig } from "@grifando/env";
import {
  ConfigProvider,
  Effect,
  Layer,
  ManagedRuntime,
  Redacted,
} from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "./app";
import { LearnerIdentity } from "./learner-identity";

const SHELL =
  '<!doctype html>\n<html lang="en">\n  <head>\n    <title>Grifando</title>\n  </head>\n  <body>\n    <div id="app"></div>\n  </body>\n</html>\n';
const CARD = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ALT = "Grifando — a personal English coach built from your own mistakes";

let webDistPath = "";

beforeAll(async () => {
  webDistPath = await mkdtemp(path.join(tmpdir(), "grifando-web-"));
  await writeFile(path.join(webDistPath, "index.html"), SHELL);
  await writeFile(path.join(webDistPath, "og-image.png"), CARD);
});

afterAll(async () => {
  await rm(webDistPath, { force: true, recursive: true });
});

const limitsOf = (env: Record<string, string>) =>
  Effect.runSync(
    Effect.provide(
      ServerConfig,
      ServerConfig.layer.pipe(
        Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
      )
    )
  ).limits;

// Serving the shell and the card needs no Learner.
const runtime = ManagedRuntime.make(LearnerIdentity.local);

const hostedApp = (siteUrl = "https://grifando.example") =>
  createApp({
    limits: limitsOf({
      DATABASE_URL: "postgres://app@db:5432/app",
      DEPLOY_PROFILE: "hosted",
    }),
    profile: "hosted",
    runtime,
    serveWeb: true,
    session: {
      secret: Redacted.make("link-preview-test-secret-xxxxxxxxxxxxxxxx"),
      secureCookie: false,
    },
    siteUrl,
    webDistPath,
  });

const localApp = () =>
  createApp({
    limits: limitsOf({ DATA_DIRECTORY: "/data/pglite" }),
    profile: "local",
    runtime,
    serveWeb: true,
    webDistPath,
  });

// Open Graph names a tag by its property, Twitter by its name, as Next.js wrote them.
const IMAGE_TAG =
  /<meta (?:property|name)="(?<key>(?:og|twitter):image[^"]*)" content="(?<content>[^"]*)" \/>\n/gu;

// The card's tags in the shell, in order, as property or name, and content.
const imageTagsOf = (shell: string) =>
  Array.from(shell.matchAll(IMAGE_TAG), (match) => [
    match.groups?.["key"],
    match.groups?.["content"],
  ]);

describe("link preview", () => {
  it("adds Grifando's Open Graph card at the public origin to the hosted shell", async () => {
    const response = await hostedApp().request(
      new Request("http://127.0.0.1:3000/academy")
    );
    const shell = await response.text();

    expect(response.status).toBe(200);
    expect(imageTagsOf(shell)).toEqual([
      ["og:image", "https://grifando.example/og-image.png"],
      ["og:image:type", "image/png"],
      ["og:image:width", "1200"],
      ["og:image:height", "630"],
      ["og:image:alt", ALT],
      ["twitter:image", "https://grifando.example/og-image.png"],
      ["twitter:image:alt", ALT],
      ["twitter:image:type", "image/png"],
      ["twitter:image:width", "1200"],
      ["twitter:image:height", "630"],
    ]);
    expect(shell.indexOf("og:image")).toBeLessThan(shell.indexOf("</head>"));
    expect(shell.replaceAll(IMAGE_TAG, "")).toBe(SHELL);
  });

  // Grifando's layout declared a Twitter card without images, and Next.js 16.4.5 fills one from
  // the Open Graph images (postProcessMetadata), so Grifando's shell named the card twice (#265).
  it("names the Open Graph card in the hosted shell's Twitter card, as Next.js filled it in", async () => {
    const response = await hostedApp().request(
      new Request("http://127.0.0.1:3000/")
    );
    const shell = await response.text();

    expect(shell).toContain(
      '<meta name="twitter:image" content="https://grifando.example/og-image.png" />\n'
    );
  });

  it("escapes the public origin it writes into the hosted shell", async () => {
    const response = await hostedApp('https://a.example/?x="1"&y=<2>').request(
      new Request("http://127.0.0.1:3000/")
    );

    const tags = imageTagsOf(await response.text());

    expect(tags[0]).toEqual([
      "og:image",
      "https://a.example/?x=&quot;1&quot;&amp;y=&lt;2&gt;/og-image.png",
    ]);
    expect(tags[5]).toEqual([
      "twitter:image",
      "https://a.example/?x=&quot;1&quot;&amp;y=&lt;2&gt;/og-image.png",
    ]);
  });

  it("serves the Open Graph card outside the session", async () => {
    const response = await hostedApp().request(
      new Request("http://127.0.0.1:3000/og-image.png")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(CARD);
  });

  it("leaves the local shell without the card", async () => {
    const app = localApp();
    const [shell, card] = await Promise.all([
      app.request(new Request("http://localhost/")),
      app.request(new Request("http://localhost/og-image.png")),
    ]);

    expect(await shell.text()).toBe(SHELL);
    expect(card.headers.get("content-type")).toBe("text/html; charset=UTF-8");
    expect(await card.text()).toBe(SHELL);
  });
});
