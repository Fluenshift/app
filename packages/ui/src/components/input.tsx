// A one-line text field. Ported from Grifando src/components/ui/input.tsx (74dbb9f).
import { Input as InputPrimitive } from "@base-ui/react/input";
import type { ComponentProps } from "react";

import { cn } from "../utils";

const Input = ({ className, type, ...props }: ComponentProps<"input">) => (
  <InputPrimitive
    className={cn(
      "file:text-foreground rounded-field border-input bg-card placeholder:text-smoke hover:border-stone focus-visible:border-foreground focus-visible:outline-violet aria-invalid:border-destructive h-11 w-full min-w-0 border px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-[0.9375rem]",
      className
    )}
    data-slot="input"
    type={type}
    {...props}
  />
);

export { Input };
