// Typed stub for the red commit of #16: the ported tests compile and fail on their checks.
import type { TechnicalCategory } from "@fluenshift/contract";

export interface TechnicalPrompt {
  id: string;
  category: TechnicalCategory;
  text: string;
}

const aiPrompt: TechnicalPrompt = { category: "AI", id: "x", text: "" };

// Two prompts with one id; every category but AI gets the AI prompt and AI gets none; every
// id finds the AI prompt. Each check sees a wrong prompt or none.
export const TECHNICAL_PROMPTS: TechnicalPrompt[] = [aiPrompt, aiPrompt];

export const getTechnicalPromptsByCategory = (
  category: TechnicalCategory
): TechnicalPrompt[] => (category === "AI" ? [] : [aiPrompt]);

export const findTechnicalPromptById = (
  _id: string
): TechnicalPrompt | undefined => aiPrompt;
