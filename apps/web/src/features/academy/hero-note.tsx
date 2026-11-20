// A hand-drawn aside pointing at the hero's actions: slanted serif italic plus an inline arrow.
// Decorative, so hidden from assistive tech. Ported from Grifando
// src/components/home/HeroNote.tsx (74dbb9f).
export const HeroNote = ({ children }: { readonly children: string }) => (
  <p
    aria-hidden="true"
    className="text-iron flex items-start gap-2 sm:items-center"
  >
    <svg
      className="shrink-0 sm:-rotate-45"
      fill="none"
      height="44"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 56 44"
      width="56"
    >
      <path d="M46 40C40 30 30 24 18 24C13 24 9 22 7 17" />
      <path d="M5 8L7 17L16 14" />
    </svg>
    <span className="hand-note max-w-[16ch] text-lg leading-tight">
      {children}
    </span>
  </p>
);
