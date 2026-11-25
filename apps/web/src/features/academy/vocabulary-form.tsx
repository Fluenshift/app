// The form that saves a vocabulary item. Ported from Grifando
// src/components/vocabulary/VocabularyForm.tsx (74dbb9f); the item's source is an Evaluation,
// which replaces Grifando's writing session (docs/adr/0004).
import { Button } from "@grifando/ui/components/button";
import { Card, CardContent, CardFooter } from "@grifando/ui/components/card";
import { Input } from "@grifando/ui/components/input";
import { Label } from "@grifando/ui/components/label";
import {
  useNavigate,
  useRouteContext,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";

const SAVE_ERROR = "Couldn't save this word. Please try again.";

export const VocabularyForm = ({
  initialExample = "",
  initialTerm = "",
  sourceEvaluationId,
}: {
  readonly initialExample?: string;
  readonly initialTerm?: string;
  readonly sourceEvaluationId?: string;
}) => {
  const { academyClient } = useRouteContext({ from: "/vocabulary" });
  const navigate = useNavigate();
  const router = useRouter();
  const [term, setTerm] = useState(initialTerm);
  const [meaningPt, setMeaningPt] = useState("");
  const [exampleSentence, setExampleSentence] = useState(initialExample);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const saved = await academyClient
      .createVocabularyItem({
        exampleSentence,
        meaningPt,
        term,
        ...(sourceEvaluationId === undefined ? {} : { sourceEvaluationId }),
      })
      .then(
        () => true,
        () => false
      );
    if (saved) {
      setTerm("");
      setMeaningPt("");
      setExampleSentence("");
      // Drops the prefill from the history state and re-reads the list.
      await navigate({ replace: true, state: {}, to: "/vocabulary" });
      await router.invalidate();
    } else {
      setError(SAVE_ERROR);
    }
    setSaving(false);
  };

  const canSave =
    term.trim() !== "" &&
    meaningPt.trim() !== "" &&
    exampleSentence.trim() !== "";

  return (
    <Card>
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
      >
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2" data-slot="field">
            <Label htmlFor="vocab-term">Term</Label>
            <Input
              id="vocab-term"
              maxLength={120}
              onChange={(event) => {
                setTerm(event.target.value);
              }}
              value={term}
            />
          </div>
          <div className="flex flex-col gap-2" data-slot="field">
            <Label htmlFor="vocab-meaning">Meaning in Portuguese</Label>
            <Input
              id="vocab-meaning"
              maxLength={300}
              onChange={(event) => {
                setMeaningPt(event.target.value);
              }}
              value={meaningPt}
            />
          </div>
          <div className="flex flex-col gap-2" data-slot="field">
            <Label htmlFor="vocab-example">Example sentence</Label>
            <Input
              id="vocab-example"
              maxLength={500}
              onChange={(event) => {
                setExampleSentence(event.target.value);
              }}
              value={exampleSentence}
            />
          </div>
          {error === null ? null : (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button disabled={!canSave || saving} type="submit">
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
