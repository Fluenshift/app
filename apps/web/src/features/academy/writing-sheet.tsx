// The sheet a Learner writes on. Ported from Grifando src/components/writing/WritingSheet.tsx
// (74dbb9f). Grifando always stopped it at 5000 characters; here the Deploy Profile's character
// cap does, and a profile without one leaves the sheet uncapped (docs/adr/0006).
import { cn } from "@grifando/ui/utils";
import { useId } from "react";

// A sheet of white paper on the cream canvas: the textarea has no box of its
// own, the sheet is the field. `variant="code"` sets it in mono for snippets.
export const WritingSheet = ({
  disabled,
  label,
  maxLength,
  minHeight = "min-h-[320px]",
  onChange,
  placeholder,
  value,
  variant = "prose",
}: {
  readonly disabled?: boolean;
  readonly label: string;
  // The Deploy Profile's character cap, or null when it has none.
  readonly maxLength: number | null;
  readonly minHeight?: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly value: string;
  readonly variant?: "prose" | "code";
}) => {
  const id = useId();

  return (
    <div className="rounded-card bg-card ring-border focus-within:ring-foreground has-[textarea:focus-visible]:outline-violet ring-1 transition-shadow has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2">
      <div className="flex items-center justify-between gap-4 px-6 pt-5 md:px-10 md:pt-8">
        <label className="label-mono text-muted-foreground" htmlFor={id}>
          {label}
        </label>
        <span
          aria-live="polite"
          className="label-mono text-muted-foreground tabular-nums"
        >
          {maxLength === null
            ? `${String(value.length)} character${value.length === 1 ? "" : "s"}`
            : `${String(value.length)} / ${String(maxLength)}`}
        </span>
      </div>
      <textarea
        aria-busy={disabled === true ? true : undefined}
        className={cn(
          "placeholder:text-smoke block field-sizing-content w-full resize-none bg-transparent px-6 pt-4 pb-8 outline-none md:px-10 md:pb-10",
          minHeight,
          variant === "code"
            ? "font-mono text-sm leading-relaxed"
            : "prose-serif text-xl leading-[1.7]"
        )}
        id={id}
        maxLength={maxLength ?? undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        readOnly={disabled}
        value={value}
      />
    </div>
  );
};
