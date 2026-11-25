// Deletes everything the hosted profile stores for the Learner. Ported from Grifando
// src/components/privacy/DeleteMyDataButton.tsx (74dbb9f): it asks once more, deletes through
// `DELETE /api/me`, then removes the browser's AI key and loads the start page again, because the
// session cookie is gone and only a page load mints a new one (docs/adr/0032, docs/adr/0036).
import { Button } from "@grifando/ui/components/button";
import { useRouteContext } from "@tanstack/react-router";
import { useState } from "react";

import { messageFor } from "../academy/academy-client";
import type { AcademyClient } from "../academy/academy-client";
import { clearAIKey } from "../settings/ai-key-store";

const FAILURE =
  "We couldn't delete your data right now. Try again in a minute.";

type Step = "idle" | "confirm" | "deleting";

// The message to show for a failed deletion, or null once the data is gone: a rate limit's own
// message, or the page's (Grifando's errorMessageFor).
const deleteEverything = async (
  academyClient: AcademyClient
): Promise<string | null> => {
  try {
    await academyClient.deleteLearner();
    return null;
  } catch (error) {
    return messageFor(error, FAILURE);
  }
};

export const DeleteMyDataButton = () => {
  const { academyClient } = useRouteContext({ from: "__root__" });
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setStep("deleting");
    setError(null);
    const failure = await deleteEverything(academyClient);
    if (failure !== null) {
      setError(failure);
      setStep("confirm");
      return;
    }
    clearAIKey();
    // A full page load on purpose: the session cookie is gone, and the next page load mints a
    // new one.
    window.location.assign("/");
  };

  return (
    <div className="space-y-3">
      {step === "idle" ? (
        <Button
          onClick={() => {
            setStep("confirm");
          }}
          type="button"
          variant="destructive"
        >
          Delete my data
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-destructive">
            This permanently deletes everything stored for you and removes your
            AI key from this browser. It cannot be undone.
          </p>
          <div
            className="flex flex-wrap items-center gap-3"
            data-slot="actions"
          >
            <Button
              disabled={step === "deleting"}
              onClick={() => {
                void handleDelete();
              }}
              type="button"
              variant="destructive"
            >
              {step === "deleting" ? "Deleting…" : "Yes, delete everything"}
            </Button>
            <Button
              disabled={step === "deleting"}
              onClick={() => {
                setStep("idle");
                setError(null);
              }}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error === null ? null : (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
