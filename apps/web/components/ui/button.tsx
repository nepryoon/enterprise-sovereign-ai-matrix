import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "destructive";
};

/** Repository-owned shadcn/ui source component adapted to NIL semantic tokens. */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", type = "button", ...props }, ref) => (
    <button ref={ref} type={type} data-slot="button" data-variant={variant}
      className={cn("button", variant === "default" && "primary", className)} {...props} />
  ),
);
Button.displayName = "Button";
