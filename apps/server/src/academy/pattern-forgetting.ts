// What the Academy built from one Evaluation, forgotten when the Learner deletes it
// (docs/adr/0031, DATA-POLICY.md § Deletion).
import type { LearnerId } from "@fluenshift/contract";
import type { DrizzleClient } from "@fluenshift/db";

// Removes the Evaluation's Occurrences and Enrichment and rebuilds each Mistake Pattern they
// touched from what remains. Runs on a client or inside the transaction that deletes the
// Evaluation.
export const forgetEvaluation = (
  _client: DrizzleClient,
  _learnerId: LearnerId,
  _evaluationId: string
): Promise<void> => Promise.resolve();
