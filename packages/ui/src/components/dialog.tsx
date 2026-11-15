// Ported from PE packages/ui/src/components/dialog.tsx (5e831bb).
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "../utils";

const Dialog = DialogPrimitive.Root;
const DialogClose = DialogPrimitive.Close;
const DialogTrigger = DialogPrimitive.Trigger;

const DialogContent = ({
  children,
  className,
  ...props
}: DialogPrimitive.Popup.Props) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black/50 transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
    <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center p-4">
      <DialogPrimitive.Popup
        className={cn(
          "bg-background text-foreground grid w-full max-w-lg gap-5 rounded-xl border p-6 shadow-xl transition-[scale,opacity] outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          className
        )}
        data-slot="dialog-content"
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Viewport>
  </DialogPrimitive.Portal>
);

const DialogTitle = ({ className, ...props }: DialogPrimitive.Title.Props) => (
  <DialogPrimitive.Title
    className={cn("text-lg font-semibold", className)}
    data-slot="dialog-title"
    {...props}
  />
);

const DialogDescription = ({
  className,
  ...props
}: DialogPrimitive.Description.Props) => (
  <DialogPrimitive.Description
    className={cn("text-muted-foreground text-sm leading-6", className)}
    data-slot="dialog-description"
    {...props}
  />
);

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
};
