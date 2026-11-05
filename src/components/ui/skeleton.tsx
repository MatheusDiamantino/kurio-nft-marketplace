import { cn } from "@/lib/utils"

/** Skeleton with shimmer effect; falls back to a static block under prefers-reduced-motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("shimmer rounded-sm", className)}
      {...props}
    />
  )
}

export { Skeleton }
