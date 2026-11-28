import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findUrlText } from "./check-url-text.ts";

const findings = (...lines: readonly string[]) =>
  findUrlText("app.ts", lines.join("\n")).map(
    ({ file, line, reason }) => `${file}:${line}: ${reason}`
  );

describe("check-url-text", () => {
  it("accepts the IDs of the Academy's records in a path", () => {
    assert.deepEqual(
      findings(
        '.post("/api/exercises/:exerciseId/attempts/:attemptId", (context) =>',
        '  [context.req.param("exerciseId"), context.req.param("attemptId")]',
        ")",
        '.post("/api/interview/:sessionId/turns/:turnId/answer", (context) =>',
        '  [context.req.param("sessionId"), context.req.param("turnId")]',
        ")"
      ),
      []
    );
  });

  it("accepts the period, the insight, the Error Category and the Evaluation ID", () => {
    assert.deepEqual(
      findings(
        '.get("/api/progress", (context) => context.req.query("period"))',
        ".get(",
        '  "/api/evaluations/:evaluationId",',
        '  (context) => context.req.param("evaluationId")',
        ")",
        "const selection = selectionInQuery(",
        '  context.req.query("insight"),',
        "  context.req.query(",
        '    "category"',
        "  )",
        ");"
      ),
      []
    );
  });

  it("refuses any other query key or path parameter", () => {
    assert.deepEqual(
      findings(
        'const correction = context.req.query("correction");',
        "const texts = context.req.queries(`originalText`);",
        '.get("/api/samples/:writingSample", (context) =>',
        '  context.req.param("writingSample")',
        ")",
        '.delete("/api/items/:itemId", (context) =>',
        '  context.req.param("itemId")',
        ")"
      ),
      [
        'app.ts:1: reads the query key "correction"',
        'app.ts:2: reads the query key "originalText"',
        'app.ts:3: names the path parameter "writingSample"',
        'app.ts:4: reads the path parameter "writingSample"',
        'app.ts:6: names the path parameter "itemId"',
        'app.ts:7: reads the path parameter "itemId"',
      ]
    );
  });

  it("refuses a read it cannot name", () => {
    assert.deepEqual(
      findings(
        "const query = context.req.query();",
        "const value = req.query(key);",
        "const parameters = context.req.param();",
        "const parameter = context.req.param(parameterName);"
      ),
      [
        "app.ts:1: reads the whole query string",
        "app.ts:2: reads a query key it does not name",
        "app.ts:3: reads every path parameter",
        "app.ts:4: reads a path parameter it does not name",
      ]
    );
  });

  it("refuses search parameters and validators of the query string or path", () => {
    assert.deepEqual(
      findings(
        'const text = new URL(context.req.url).searchParams.get("text");',
        "const parsed = new URLSearchParams(context.req.url);",
        '.get("/api/search", validator("query", parse), search)',
        ".get('/api/samples', validator('param', parse), samples)"
      ),
      [
        "app.ts:1: reads search parameters",
        "app.ts:2: reads search parameters",
        "app.ts:3: validates the query string",
        "app.ts:4: validates the path parameters",
      ]
    );
  });

  it("leaves the rest of a URL alone", () => {
    assert.deepEqual(
      findings(
        "const url = new URL(request.url);",
        "const requestPath = new URL(context.req.url).pathname;",
        'if (context.req.path.startsWith("/api/")) {}',
        'app.get("/*", webFallback(options.webDistPath));'
      ),
      []
    );
  });
});
