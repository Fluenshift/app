// Ported from Grifando src/server/domain/writing/technicalPrompts.ts; SPEC.md is Grifando's.
// The prompt bank is copied verbatim.
import { TechnicalCategory } from "@fluenshift/contract";

export interface TechnicalPrompt {
  id: string;
  category: TechnicalCategory;
  text: string;
}

// Two prompts per TechnicalCategory — real things developers explain, not
// generic English practice (SPEC.md §5.6).
export const TECHNICAL_PROMPTS: TechnicalPrompt[] = [
  {
    id: "backend-1",
    category: TechnicalCategory.BACKEND,
    text: "Explain the difference between synchronous and asynchronous request handling.",
  },
  {
    id: "backend-2",
    category: TechnicalCategory.BACKEND,
    text: "Describe how you would design a rate limiter for a public API.",
  },
  {
    id: "frontend-1",
    category: TechnicalCategory.FRONTEND,
    text: "Explain the difference between server-side and client-side rendering.",
  },
  {
    id: "frontend-2",
    category: TechnicalCategory.FRONTEND,
    text: "Describe how you would optimize a slow-loading web page.",
  },
  {
    id: "devops-1",
    category: TechnicalCategory.DEVOPS,
    text: "Explain what a CI/CD pipeline does and why it's useful.",
  },
  {
    id: "devops-2",
    category: TechnicalCategory.DEVOPS,
    text: "Describe the difference between a container and a virtual machine.",
  },
  {
    id: "databases-1",
    category: TechnicalCategory.DATABASES,
    text: "Explain what a database index is and when you'd add one.",
  },
  {
    id: "databases-2",
    category: TechnicalCategory.DATABASES,
    text: "Describe the difference between a primary key and a foreign key.",
  },
  {
    id: "cloud-1",
    category: TechnicalCategory.CLOUD,
    text: "Explain the difference between horizontal and vertical scaling.",
  },
  {
    id: "cloud-2",
    category: TechnicalCategory.CLOUD,
    text: "Describe what a load balancer does.",
  },
  {
    id: "architecture-1",
    category: TechnicalCategory.ARCHITECTURE,
    text: "Explain the Repository Pattern and why (or why not) you'd use it in a project.",
  },
  {
    id: "architecture-2",
    category: TechnicalCategory.ARCHITECTURE,
    text: "Describe the difference between a monolith and a microservices architecture.",
  },
  {
    id: "algorithms-1",
    category: TechnicalCategory.ALGORITHMS,
    text: "Explain the difference between a stack and a queue.",
  },
  {
    id: "algorithms-2",
    category: TechnicalCategory.ALGORITHMS,
    text: "Describe how binary search works and why it's faster than a linear scan.",
  },
  {
    id: "testing-1",
    category: TechnicalCategory.TESTING,
    text: "Explain the difference between a unit test and an integration test.",
  },
  {
    id: "testing-2",
    category: TechnicalCategory.TESTING,
    text: "Describe why testing matters, using an example from a project you've worked on.",
  },
  {
    id: "git-1",
    category: TechnicalCategory.GIT,
    text: "Explain the difference between git merge and git rebase.",
  },
  {
    id: "git-2",
    category: TechnicalCategory.GIT,
    text: "Describe how you would resolve a merge conflict.",
  },
  {
    id: "github-1",
    category: TechnicalCategory.GITHUB,
    text: "Write a short GitHub issue describing a bug you've run into recently.",
  },
  {
    id: "github-2",
    category: TechnicalCategory.GITHUB,
    text: "Write a pull request description for a change you imagine making to a to-do list app.",
  },
  {
    id: "code-review-1",
    category: TechnicalCategory.CODE_REVIEW,
    text: "Explain how you would give feedback on a pull request that works but is hard to read.",
  },
  {
    id: "code-review-2",
    category: TechnicalCategory.CODE_REVIEW,
    text: "Describe what you look for when reviewing someone else's code.",
  },
  {
    id: "security-1",
    category: TechnicalCategory.SECURITY,
    text: "Explain what SQL injection is and how to prevent it.",
  },
  {
    id: "security-2",
    category: TechnicalCategory.SECURITY,
    text: "Describe the difference between authentication and authorization.",
  },
  {
    id: "ai-1",
    category: TechnicalCategory.AI,
    text: "Explain what a large language model is to someone with no technical background.",
  },
  {
    id: "ai-2",
    category: TechnicalCategory.AI,
    text: "Describe a use case where you'd use AI in a project, and one where you wouldn't.",
  },
  {
    id: "system-design-1",
    category: TechnicalCategory.SYSTEM_DESIGN,
    text: "Explain how you would design a URL shortener at a high level.",
  },
  {
    id: "system-design-2",
    category: TechnicalCategory.SYSTEM_DESIGN,
    text: "Describe the tradeoffs between consistency and availability in a distributed system.",
  },
];

export const getTechnicalPromptsByCategory = (
  category: TechnicalCategory
): TechnicalPrompt[] =>
  TECHNICAL_PROMPTS.filter((prompt) => prompt.category === category);

export const findTechnicalPromptById = (
  id: string
): TechnicalPrompt | undefined =>
  TECHNICAL_PROMPTS.find((prompt) => prompt.id === id);
