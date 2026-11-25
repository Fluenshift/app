// The form that keeps the visitor's AI key in this browser and tests it. Ported from Grifando
// src/components/settings/AIKeyForm.tsx (74dbb9f), with its fix 2a86084: a browser that blocks
// storage gets its own message. The SPA renders nothing on a server, so the form reads the stored
// key when it mounts; the key test goes through the Academy client, which sends the stored key in
// the hosted profile (docs/adr/0034). OpenRouter comes first, since only its key runs the Judge
// (docs/adr/0035); Grifando offered Gemini first, as its free key ran everything there.
import {
  isTrainerKeyProvider,
  TRAINER_KEY_PROVIDERS,
} from "@grifando/contract";
import type { TrainerKeyProvider } from "@grifando/contract";
import { Button } from "@grifando/ui/components/button";
import { Card, CardContent, CardFooter } from "@grifando/ui/components/card";
import { Input } from "@grifando/ui/components/input";
import { Label } from "@grifando/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@grifando/ui/components/radio-group";
import { useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import type { FormEvent } from "react";

import { messageFor } from "../academy/academy-client";
import type { AcademyClient } from "../academy/academy-client";
import { clearAIKey, getStoredAIKey, saveAIKey } from "./ai-key-store";
import type { AICredentials } from "./ai-key-store";

// Each provider's choice, and the line that names a saved key of it.
const PROVIDER_COPY: Record<
  TrainerKeyProvider,
  { readonly label: string; readonly note: string; readonly saved: string }
> = {
  anthropic: {
    label: "Anthropic",
    note: "— Academy only",
    saved: "An Anthropic key is saved in this browser.",
  },
  gemini: {
    label: "Gemini",
    note: "— free key, Academy only",
    saved: "A Gemini key is saved in this browser.",
  },
  openrouter: {
    label: "OpenRouter",
    note: "— recommended, runs everything",
    saved: "An OpenRouter key is saved in this browser.",
  },
};

type Status =
  | { readonly kind: "idle" }
  | { readonly kind: "testing" }
  | { readonly kind: "works" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "removed" };

const TEST_FAILURE =
  "We couldn't check the key right now. It's saved — try again in a minute.";
const STATUS_MESSAGES = {
  busy: "The provider is busy, so we couldn't check the key. It's saved — try again in a minute.",
  invalid:
    "This key doesn't work. Check that you copied all of it and picked the right provider.",
} as const;
const BLOCKED_STORAGE =
  "This browser blocked saving the key (private mode or storage turned off). Allow site storage and try again.";

// What the provider says of the stored key, as the form's next status. A failed test shows the
// route's message for a rate limit or a key problem, and Grifando's own message otherwise.
const testedStatus = async (client: AcademyClient): Promise<Status> => {
  try {
    const status = await client.testAIKey();
    return status === "works"
      ? { kind: "works" }
      : { kind: "error", message: STATUS_MESSAGES[status] };
  } catch (error) {
    return { kind: "error", message: messageFor(error, TEST_FAILURE) };
  }
};

export const AIKeyForm = () => {
  const { academyClient } = useRouteContext({ from: "/settings" });
  const [saved, setSaved] = useState<AICredentials | null>(() =>
    getStoredAIKey()
  );
  const [chosenProvider, setChosenProvider] = useState<TrainerKeyProvider>();
  const provider = chosenProvider ?? saved?.provider ?? "openrouter";
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (apiKey.trim() !== "") {
      const credentials = { apiKey: apiKey.trim(), provider };
      if (!saveAIKey(credentials)) {
        setStatus({ kind: "error", message: BLOCKED_STORAGE });
        return;
      }
      setSaved(credentials);
      setApiKey("");
    }
    setStatus({ kind: "testing" });
    setStatus(await testedStatus(academyClient));
  };

  const handleRemove = () => {
    clearAIKey();
    setSaved(null);
    setApiKey("");
    setStatus({ kind: "removed" });
  };

  const testing = status.kind === "testing";
  const canSave = !testing && (apiKey.trim().length > 0 || saved !== null);

  return (
    <Card>
      <form
        onSubmit={(event) => {
          void handleSave(event);
        }}
      >
        <CardContent className="flex flex-col gap-6">
          <fieldset className="space-y-3">
            <legend className="text-iron mb-3 text-sm">Provider</legend>
            <RadioGroup
              disabled={testing}
              onValueChange={(value) => {
                if (isTrainerKeyProvider(value)) {
                  setChosenProvider(value);
                }
              }}
              value={provider}
            >
              {TRAINER_KEY_PROVIDERS.map((id) => (
                <Label
                  className="text-foreground cursor-pointer gap-3 text-base"
                  htmlFor={`ai-provider-${id}`}
                  key={id}
                >
                  <RadioGroupItem id={`ai-provider-${id}`} value={id} />
                  {PROVIDER_COPY[id].label}{" "}
                  <span className="text-muted-foreground">
                    {PROVIDER_COPY[id].note}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="flex flex-col gap-2" data-slot="field">
            <Label htmlFor="ai-key">API key</Label>
            <Input
              autoComplete="off"
              disabled={testing}
              id="ai-key"
              maxLength={256}
              onChange={(event) => {
                setApiKey(event.target.value);
              }}
              placeholder={
                saved === null
                  ? "Paste your key here"
                  : "Paste a new key to replace the saved one"
              }
              spellCheck={false}
              type="password"
              value={apiKey}
            />
            {saved === null ? null : (
              <p className="text-muted-foreground text-sm">
                {PROVIDER_COPY[saved.provider].saved}
              </p>
            )}
          </div>

          <div aria-live="polite" className="text-sm empty:hidden">
            {status.kind === "testing" ? (
              <p className="text-muted-foreground">Checking your key...</p>
            ) : null}
            {status.kind === "works" ? (
              <p className="text-success">
                Your key works. You&rsquo;re all set.
              </p>
            ) : null}
            {status.kind === "removed" ? (
              <p className="text-muted-foreground">
                Key removed from this browser.
              </p>
            ) : null}
            {status.kind === "error" ? (
              <p className="text-destructive" role="alert">
                {status.message}
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter>
          <Button disabled={!canSave} type="submit">
            {testing ? "Testing..." : "Save & test"}
          </Button>
          <Button
            disabled={testing || saved === null}
            onClick={handleRemove}
            type="button"
            variant="outline"
          >
            Remove
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
