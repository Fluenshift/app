// A fake Academy client for the screen tests: it answers from explicit fixtures, and a read with
// no fixture fails.
import type { DailyChallenge } from "@fluenshift/contract";

import { unavailableAcademyClient } from "./academy-client";
import type { AcademyClient } from "./academy-client";

interface InMemoryAcademyClientOptions {
  readonly dailyChallenge?: DailyChallenge;
}

export const createInMemoryAcademyClient = ({
  dailyChallenge,
}: InMemoryAcademyClientOptions = {}): AcademyClient => ({
  getDailyChallenge: () =>
    dailyChallenge === undefined
      ? unavailableAcademyClient.getDailyChallenge()
      : Promise.resolve(dailyChallenge),
});
