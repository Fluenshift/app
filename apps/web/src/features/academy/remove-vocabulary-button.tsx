// Removes one vocabulary item. Ported from Grifando
// src/components/vocabulary/RemoveVocabularyButton.tsx (74dbb9f).
import { Button } from "@fluenshift/ui/components/button";
import { useRouteContext, useRouter } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState } from "react";

export const RemoveVocabularyButton = ({
  id,
  term,
}: {
  readonly id: string;
  readonly term: string;
}) => {
  const { academyClient } = useRouteContext({ from: "/vocabulary" });
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  // An item already gone (another tab) counts as removed; any other failure leaves the list as
  // it is, as Grifando refreshed only after a removal.
  const handleRemove = async () => {
    setRemoving(true);
    const removed = await academyClient.deleteVocabularyItem(id).then(
      () => true,
      () => false
    );
    if (removed) {
      await router.invalidate();
    }
    setRemoving(false);
  };

  return (
    <Button
      aria-label={`Remove ${term}`}
      disabled={removing}
      onClick={() => {
        void handleRemove();
      }}
      size="icon-xs"
      variant="ghost"
    >
      <X />
    </Button>
  );
};
