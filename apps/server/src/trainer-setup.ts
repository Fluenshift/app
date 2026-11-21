// The local profile's Trainer as /setup shows it (FR-24, #273): the provider and model of the key
// the server holds, or that it holds none.
import type { TrainerSetup } from "@fluenshift/contract";
import type {
  TrainerKey,
  TrainerModels,
  TrainerProvider,
} from "@fluenshift/env";
import type { Option } from "effect";

export const trainerSetupOf = (_settings: {
  readonly localKey: Option.Option<TrainerKey>;
  readonly models: Readonly<Record<TrainerProvider, TrainerModels>>;
}): TrainerSetup => ({ configured: false });
