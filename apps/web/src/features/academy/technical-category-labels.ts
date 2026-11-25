// How the Academy names each Technical Category. Ported from Grifando
// src/lib/technicalCategoryLabels.ts (74dbb9f).
import type { TechnicalCategory } from "@grifando/contract";

export const TECHNICAL_CATEGORY_LABELS: Readonly<
  Record<TechnicalCategory, string>
> = {
  AI: "AI",
  ALGORITHMS: "Algorithms",
  ARCHITECTURE: "Architecture",
  BACKEND: "Backend",
  CLOUD: "Cloud",
  CODE_REVIEW: "Code Review",
  DATABASES: "Databases",
  DEVOPS: "DevOps",
  FRONTEND: "Frontend",
  GIT: "Git",
  GITHUB: "GitHub",
  SECURITY: "Security",
  SYSTEM_DESIGN: "System Design",
  TESTING: "Testing",
};
