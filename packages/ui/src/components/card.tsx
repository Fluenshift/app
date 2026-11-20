// A card on the cream canvas, with its header, title, content and footer. Ported from Grifando
// src/components/ui/card.tsx (74dbb9f); the parts no screen uses yet are left out.
import type { ComponentProps } from "react";

import { cn } from "../utils";

const Card = ({
  className,
  size = "default",
  ...props
}: ComponentProps<"div"> & { readonly size?: "default" | "sm" }) => (
  <div
    className={cn(
      "group/card rounded-card bg-card text-card-foreground ring-border flex flex-col gap-(--card-spacing) overflow-hidden py-(--card-spacing) text-sm ring-1 [--card-spacing:--spacing(6)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:[--card-spacing:--spacing(5)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 md:[--card-spacing:--spacing(8)] md:data-[size=sm]:[--card-spacing:--spacing(5)] *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl [&>form]:flex [&>form]:flex-col [&>form]:gap-(--card-spacing)",
      className
    )}
    data-size={size}
    data-slot="card"
    {...props}
  />
);

const CardHeader = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn(
      "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
      className
    )}
    data-slot="card-header"
    {...props}
  />
);

const CardTitle = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn(
      "text-heading-sm text-foreground group-data-[size=sm]/card:text-subheading",
      className
    )}
    data-slot="card-title"
    {...props}
  />
);

const CardContent = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn("px-(--card-spacing)", className)}
    data-slot="card-content"
    {...props}
  />
);

const CardFooter = ({ className, ...props }: ComponentProps<"div">) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-3 px-(--card-spacing) pb-(--card-spacing)",
      className
    )}
    data-slot="card-footer"
    {...props}
  />
);

export { Card, CardContent, CardFooter, CardHeader, CardTitle };
