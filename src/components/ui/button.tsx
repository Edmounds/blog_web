import * as React from "react"

type ButtonVariant = "default" | "outline" | "ghost" | "destructive"
type ButtonSize = "default" | "sm"

const baseClass = "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/85",
  outline: "border-[var(--border-strong)] bg-transparent text-foreground hover:border-foreground hover:bg-muted aria-expanded:bg-muted aria-expanded:text-foreground",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
  destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
}
const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 gap-1.5 px-5",
  sm: "h-8 gap-1 px-3.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={`${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${className ?? ""}`.trim()}
      {...props}
    />
  )
}

export { Button }
