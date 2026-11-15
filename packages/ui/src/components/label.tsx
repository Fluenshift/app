// Ported from PE packages/ui/src/components/label.tsx (5e831bb).
import type { ComponentProps } from "react";

import { cn } from "../utils";

const Label = ({ className, htmlFor, ...props }: ComponentProps<"label">) => (
  <label
    data-slot="label"
    htmlFor={htmlFor}
    className={cn(
      "flex items-center gap-2 text-xs leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className
    )}
    {...props}
  />
);

export { Label };
