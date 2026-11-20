// A group of radio choices. Ported from Grifando src/components/ui/radio-group.tsx (74dbb9f).
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";

import { cn } from "../utils";

const RadioGroup = ({ className, ...props }: RadioGroupPrimitive.Props) => (
  <RadioGroupPrimitive
    className={cn("grid w-full gap-2", className)}
    data-slot="radio-group"
    {...props}
  />
);

const RadioGroupItem = ({ className, ...props }: RadioPrimitive.Root.Props) => (
  <RadioPrimitive.Root
    className={cn(
      "group/radio-group-item peer border-smoke bg-card group-has-[:focus-visible]/field-label:not-data-checked:border-input focus-visible:outline-violet aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-foreground data-checked:border-foreground data-checked:bg-foreground data-checked:text-primary-foreground group-has-[:focus-visible]/field-label:data-checked:border-foreground relative flex aspect-square size-4 shrink-0 rounded-full border outline-none group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3",
      className
    )}
    data-slot="radio-group-item"
    {...props}
  >
    <RadioPrimitive.Indicator
      className="flex size-4 items-center justify-center"
      data-slot="radio-group-indicator"
    >
      <span className="bg-primary-foreground absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" />
    </RadioPrimitive.Indicator>
  </RadioPrimitive.Root>
);

export { RadioGroup, RadioGroupItem };
