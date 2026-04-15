import type React from "react"
import { cn } from "@/lib/utils"

interface ContentContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function ContentContainer({ children, className, ...props }: ContentContainerProps) {
  return (
    <div
      className={cn(
        "glass-card-elevated rounded-[20px] sm:rounded-[24px] overflow-hidden",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function ContentHeader({ children, className, ...props }: ContentContainerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border-b border-foreground/[0.06] px-4 sm:px-6 py-3.5 sm:py-4 bg-[var(--qc-bg-pure)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
