// A small label in mono capitals. Ported from Grifando src/components/ui/badge.tsx (74dbb9f),
// as a plain span: no screen renders it as another element.
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "../utils";

const badgeVariants = cva(
  "group/badge rounded-pill focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent px-2 font-mono text-[0.6875rem] font-normal tracking-[0.1em] whitespace-nowrap uppercase transition-all focus-visible:ring-[3px] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-iron",
        destructive: "border-destructive/30 bg-destructive/5 text-destructive",
        ghost: "text-muted-foreground",
        link: "text-foreground underline underline-offset-4",
        outline: "border-border bg-card text-iron [a]:hover:bg-linen",
        secondary: "bg-linen text-foreground [a]:hover:bg-stone",
        success: "border-success/30 bg-success/5 text-success",
      },
    },
  }
);

const Badge = ({
  className,
  variant = "default",
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) => (
  <span
    className={cn(badgeVariants({ variant }), className)}
    data-slot="badge"
    {...props}
  />
);

export { Badge, badgeVariants };
