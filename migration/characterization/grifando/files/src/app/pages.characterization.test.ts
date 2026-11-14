// Characterization of the five pages that read repositories in Server Components, at the
// Grifando baseline: src/app/page.tsx, mistakes, vocabulary, today and write. Each page runs as
// a function against the test database, with the session faked, and the characterization reads
// the element tree it returns: the props it hands to each client component, and the text it
// renders itself. That is the data the Academy's read endpoints of Phase 5e must supply. The
// clock is fixed, because due and fading patterns, streaks and the daily prompt read it.
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { createPrismaClient } from "@/server/db/client";
import { resetDatabase } from "@/server/db/test-utils";

const holder = vi.hoisted(() => ({ prisma: undefined as unknown, userId: "visitor-1" }));

vi.mock("@/server/db/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/db/client")>();
  // Not via test-utils: it imports this (mocked) module, which would deadlock.
  holder.prisma = original.createPrismaClient(process.env.TEST_DATABASE_URL!);
  return { ...original, prisma: holder.prisma };
});
vi.mock("@/server/session/currentUser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/session/currentUser")>()),
  getCurrentUserId: vi.fn(async () => holder.userId),
}));

import MistakesPage from "@/app/mistakes/page";
import HomePage from "@/app/page";
import TodayPage from "@/app/today/page";
import VocabularyPage from "@/app/vocabulary/page";
import WritePage from "@/app/write/page";
import { ProgressSummary } from "@/components/dashboard/ProgressSummary";
import { RecentMistakes } from "@/components/dashboard/RecentMistakes";
import { RecentWriting } from "@/components/dashboard/RecentWriting";
import { StreakStatus } from "@/components/dashboard/StreakStatus";
import { WeakAreas } from "@/components/dashboard/WeakAreas";
import { PageHeader } from "@/components/layout/PageHeader";
import { TodaySession } from "@/components/today/TodaySession";
import { RemoveVocabularyButton } from "@/components/vocabulary/RemoveVocabularyButton";
import { VocabularyForm } from "@/components/vocabulary/VocabularyForm";
import { WritingCoach } from "@/components/writing/WritingCoach";

const prisma = holder.prisma as ReturnType<typeof createPrismaClient>;
const NOW = new Date("2026-03-05T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY);

type Props = Record<string, unknown>;

function walk(node: ReactNode, visit: (element: ReactElement<Props>) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  if (!isValidElement(node)) return;
  const element = node as ReactElement<Props>;
  visit(element);
  walk(element.props.children as ReactNode, visit);
}

// Props of every element of the given component, in tree order.
function propsOf(node: ReactNode, component: unknown): Props[] {
  const found: Props[] = [];
  walk(node, (element) => {
    if (element.type === component) {
      const { children: _children, ...props } = element.props;
      found.push(props);
    }
  });
  return found;
}

// The text the page itself renders: strings and numbers among the children, in tree order.
function textOf(node: ReactNode): string {
  const parts: string[] = [];
  const collect = (value: ReactNode): void => {
    if (typeof value === "string" || typeof value === "number") parts.push(String(value));
    else if (Array.isArray(value)) value.forEach(collect);
    else if (isValidElement(value)) collect((value as ReactElement<Props>).props.children as ReactNode);
  };
  collect(node);
  return parts.join("").replace(/\s+/g, " ");
}

function page(searchParams: Record<string, string | string[]> = {}) {
  return { params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) } as never;
}

async function seedUser(userId: string) {
  await prisma.user.upsert({ where: { id: userId }, create: { id: userId }, update: {} });
}

async function seedPattern(
  userId: string,
  data: {
    category: "PREPOSITIONS" | "ARTICLES" | "VERB_TENSE";
    patternKey: string;
    occurrenceCount: number;
    masteryLevel?: "ACTIVE" | "IMPROVING" | "MASTERED";
    lastPracticedAt: Date;
    lastSeenAt: Date;
    correctCount?: number;
  },
) {
  await seedUser(userId);
  return prisma.mistakePattern.create({
    data: {
      userId,
      exampleOriginal: `${data.patternKey} original`,
      exampleCorrection: `${data.patternKey} correction`,
      ...data,
    },
  });
}

async function seedAnalyzedSession(
  userId: string,
  createdAt: Date,
  scores: number,
  occurrences: { patternId: string; category: "PREPOSITIONS" | "ARTICLES" | "VERB_TENSE"; l1Transfer?: boolean }[] = [],
) {
  await seedUser(userId);
  return prisma.writingSession.create({
    data: {
      userId,
      promptType: "FREE",
      originalText: `Text written ${createdAt.toISOString()}.`,
      status: "ANALYZED",
      createdAt,
      analysis: {
        create: {
          correctedText: "Corrected.",
          naturalText: "Natural.",
          overallFeedback: "Feedback.",
          grammarScore: scores,
          vocabularyScore: scores,
          clarityScore: scores,
          naturalnessScore: scores,
          modelId: "test-model",
          createdAt,
          occurrences: {
            create: occurrences.map((occurrence) => ({
              patternId: occurrence.patternId,
              category: occurrence.category,
              severity: "ERROR" as const,
              originalSpan: "x",
              correctedSpan: "y",
              explanation: "z",
              example: "w",
              l1Transfer: occurrence.l1Transfer ?? false,
              createdAt,
            })),
          },
        },
      },
    },
  });
}

beforeEach(async () => {
  holder.userId = "visitor-1";
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  await resetDatabase(prisma);
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("/today", () => {
  it("hands TodaySession today's challenge, biased toward the visitor's active categories", async () => {
    const plain = await TodayPage();
    expect(propsOf(plain, PageHeader)).toEqual([
      {
        title: "Today",
        description:
          "One short piece of writing, then a review mixing today’s mistakes with the ones you’re starting to forget.",
      },
    ]);
    expect(propsOf(plain, TodaySession)).toEqual([
      {
        challenge: {
          promptType: "DAILY_CHALLENGE",
          promptText: "Explain what an API is to someone with no programming background.",
        },
      },
    ]);

    await seedPattern("visitor-1", {
      category: "PREPOSITIONS",
      patternKey: "depend-on",
      occurrenceCount: 1,
      lastPracticedAt: NOW,
      lastSeenAt: NOW,
    });
    expect(propsOf(await TodayPage(), TodaySession)).toEqual([
      {
        challenge: {
          promptType: "DAILY_CHALLENGE",
          promptText: "Describe a bug you recently solved and how you found the root cause.",
        },
      },
    ]);
  });
});

describe("/write", () => {
  it("takes its challenge and heading from the query", async () => {
    const read = async (searchParams: Record<string, string>) => {
      const tree = await WritePage(page(searchParams));
      return {
        title: propsOf(tree, PageHeader)[0]?.title,
        challenge: propsOf(tree, WritingCoach)[0]?.initialChallenge,
      };
    };

    expect(await read({})).toEqual({ title: "Write", challenge: undefined });
    expect(await read({ promptId: "missing" })).toEqual({ title: "Write", challenge: undefined });
    expect(await read({ promptId: "backend-1" })).toEqual({
      title: "Technical English",
      challenge: {
        promptType: "TECHNICAL",
        promptText: "Explain the difference between synchronous and asynchronous request handling.",
        technicalCategory: "BACKEND",
      },
    });
    expect(await read({ mode: "daily" })).toEqual({
      title: "Today’s challenge",
      challenge: {
        promptType: "DAILY_CHALLENGE",
        promptText: "Explain what an API is to someone with no programming background.",
      },
    });
  });
});

describe("/vocabulary", () => {
  it("lists the visitor's items newest first and prefills the form from the query", async () => {
    const empty = await VocabularyPage(page());
    expect(textOf(empty)).toContain("0 entries");
    expect(textOf(empty)).toContain("Nothing saved yet.");
    expect(propsOf(empty, VocabularyForm)).toEqual([
      { initialTerm: undefined, initialExample: undefined, sourceSessionId: undefined },
    ]);

    await seedUser("visitor-1");
    await seedUser("other-user");
    const older = await prisma.vocabularyItem.create({
      data: { userId: "visitor-1", term: "rely on", meaningPt: "depender de", exampleSentence: "I rely on tests.", createdAt: daysAgo(2) },
    });
    const newer = await prisma.vocabularyItem.create({
      data: { userId: "visitor-1", term: "roll out", meaningPt: "implantar", exampleSentence: "We roll out on Fridays.", createdAt: daysAgo(1) },
    });
    await prisma.vocabularyItem.create({
      data: { userId: "other-user", term: "someone else's", meaningPt: "de outra pessoa", exampleSentence: "Not yours." },
    });

    const listed = await VocabularyPage(page({ term: ["take over", "ignored"], example: "I take over.", sessionId: "session-1" }));
    expect(textOf(listed)).toContain("2 entries");
    expect(textOf(listed)).toContain("roll outimplantar“We roll out on Fridays.”");
    expect(propsOf(listed, RemoveVocabularyButton)).toEqual([
      { id: newer.id, term: "roll out" },
      { id: older.id, term: "rely on" },
    ]);
    expect(propsOf(listed, VocabularyForm)).toEqual([
      { initialTerm: "take over", initialExample: "I take over.", sourceSessionId: "session-1" },
    ]);
  });
});

describe("/mistakes", () => {
  it("shows each pattern once with its mastery, the category breakdown and the due count", async () => {
    const empty = textOf(await MistakesPage(page()));
    expect(empty).toContain("No mistakes recorded yet.");
    expect(empty).toContain("0 patterns");
    expect(empty).toContain("No mistakes yet. Write something to get started.");

    // Half-life 1 day: recall far below 0.5 after 5 days, so both patterns are due.
    const due = await seedPattern("visitor-1", {
      category: "PREPOSITIONS",
      patternKey: "depend-on",
      occurrenceCount: 2,
      lastPracticedAt: daysAgo(5),
      lastSeenAt: daysAgo(5),
    });
    const fading = await seedPattern("visitor-1", {
      category: "ARTICLES",
      patternKey: "a-an",
      occurrenceCount: 1,
      masteryLevel: "MASTERED",
      lastPracticedAt: daysAgo(5),
      lastSeenAt: daysAgo(40),
    });
    await seedAnalyzedSession("visitor-1", daysAgo(5), 80, [
      { patternId: due.id, category: "PREPOSITIONS" },
      { patternId: due.id, category: "PREPOSITIONS", l1Transfer: true },
    ]);
    await seedAnalyzedSession("visitor-1", daysAgo(40), 80, [{ patternId: fading.id, category: "ARTICLES" }]);

    const text = textOf(await MistakesPage(page()));
    expect(text).toContain("2 patterns are due for review.");
    expect(text).toContain("Prepositions66.7%");
    expect(text).toContain("Articles33.3%");
    expect(text).toContain("2 patterns");
    expect(text).toContain("depend-on original → corrected todepend-on correction");
    expect(text).toContain("PrepositionsActive2× · last seen");
    expect(text).toContain("ArticlesFading1× · last seen");
  });

  it("narrows the breakdown to 30 days and the patterns to those from Portuguese", async () => {
    const recent = await seedPattern("visitor-1", {
      category: "PREPOSITIONS",
      patternKey: "depend-on",
      occurrenceCount: 1,
      lastPracticedAt: NOW,
      lastSeenAt: NOW,
    });
    const old = await seedPattern("visitor-1", {
      category: "ARTICLES",
      patternKey: "a-an",
      occurrenceCount: 1,
      lastPracticedAt: NOW,
      lastSeenAt: daysAgo(40),
    });
    await seedAnalyzedSession("visitor-1", daysAgo(1), 80, [{ patternId: recent.id, category: "PREPOSITIONS", l1Transfer: true }]);
    await seedAnalyzedSession("visitor-1", daysAgo(40), 80, [{ patternId: old.id, category: "ARTICLES" }]);

    const lastMonth = textOf(await MistakesPage(page({ window: "30d" })));
    expect(lastMonth).toContain("Prepositions100%");
    expect(lastMonth).not.toContain("Articles50%");

    const fromPortuguese = textOf(await MistakesPage(page({ origin: "pt" })));
    expect(fromPortuguese).toContain("1 pattern");
    expect(fromPortuguese).toContain("depend-on original");
    expect(fromPortuguese).not.toContain("a-an original");

    expect(textOf(await MistakesPage(page({ origin: "pt", window: "30d" })))).toContain("Prepositions100%");
    await prisma.mistakeOccurrence.updateMany({ data: { l1Transfer: false } });
    expect(textOf(await MistakesPage(page({ origin: "pt" })))).toContain("No mistakes flagged as coming from Portuguese yet.");
  });
});

describe("/", () => {
  it("feeds the dashboard's streak, progress, weak areas and recent lists", async () => {
    const empty = await HomePage();
    expect(propsOf(empty, StreakStatus)).toEqual([{ streak: { current: 0, longest: 0, activeToday: false } }]);
    expect(propsOf(empty, ProgressSummary)).toEqual([
      { writingSessionsCompleted: 0, exercisesCompleted: 0, exerciseAccuracy: null, averageScores: null },
    ]);
    expect(propsOf(empty, WeakAreas)).toEqual([{ breakdown: [] }]);
    expect(propsOf(empty, RecentMistakes)).toEqual([{ patterns: [] }]);
    expect(propsOf(empty, RecentWriting)).toEqual([{ sessions: [] }]);
    expect(textOf(empty)).toContain("Explain what an API is to someone with no programming background.");
    expect(textOf(empty)).toContain("Write something first — exercises are generated from mistakes found in your own writing.");

    const pattern = await seedPattern("visitor-1", {
      category: "PREPOSITIONS",
      patternKey: "depend-on",
      occurrenceCount: 3,
      lastPracticedAt: daysAgo(5),
      lastSeenAt: daysAgo(1),
    });
    for (const [days, score] of [[3, 70], [2, 80], [1, 90], [0, 100]] as const) {
      await seedAnalyzedSession("visitor-1", new Date(daysAgo(days).getTime() - 2 * 60 * 60 * 1000), score, [
        { patternId: pattern.id, category: "PREPOSITIONS" },
      ]);
    }
    const exercise = await prisma.exercise.create({
      data: { userId: "visitor-1", type: "MULTIPLE_CHOICE", sourcePatternId: pattern.id, promptData: {} },
    });
    for (const isCorrect of [true, false, true]) {
      await prisma.exerciseAttempt.create({
        data: { exerciseId: exercise.id, userAnswer: "1", isCorrect, feedback: "f", attemptedAt: daysAgo(0) },
      });
    }

    const tree = await HomePage();
    expect(propsOf(tree, StreakStatus)).toEqual([{ streak: { current: 4, longest: 4, activeToday: true } }]);
    expect(propsOf(tree, ProgressSummary)).toEqual([
      {
        writingSessionsCompleted: 4,
        exercisesCompleted: 3,
        exerciseAccuracy: { correct: 2, total: 3 },
        averageScores: { grammar: 85, vocabulary: 85, clarity: 85, naturalness: 85 },
      },
    ]);
    expect(propsOf(tree, WeakAreas)).toEqual([
      { breakdown: [{ category: "PREPOSITIONS", count: 4, percentage: 100 }] },
    ]);
    const [recent] = propsOf(tree, RecentMistakes);
    expect((recent?.patterns as { id: string }[]).map((item) => item.id)).toEqual([pattern.id]);
    const [writing] = propsOf(tree, RecentWriting);
    expect((writing?.sessions as { originalText: string }[]).map((session) => session.originalText)).toHaveLength(3);
    expect(textOf(tree)).toContain("1 pattern is due for review — you're likely to be forgetting it.");
    expect(textOf(tree)).toContain("You've mixed up Prepositions 3 times.");
    expect(textOf(tree)).toContain("Describe a bug you recently solved and how you found the root cause.");
  });
});
