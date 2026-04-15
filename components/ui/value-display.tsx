import type React from "react"

interface ValueDisplayProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  variant?: "default" | "highlight" | "danger" | "success" | "rank"
  className?: string
}

export function ValueDisplay({ label, value, icon, variant = "default", className = "" }: ValueDisplayProps) {
  const variantStyles = {
    default: "text-foreground/60",
    highlight: "text-foreground",
    danger: "text-red-500",
    success: "text-green-600",
    rank: "text-foreground font-extrabold",
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div
        className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide font-tiktok flex items-center gap-1"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
      >
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </div>
      <div
        className={`text-xl sm:text-2xl md:text-3xl font-bold transition-all duration-120 ${variantStyles[variant]}`}
        style={{
          fontFamily: "var(--font-opensans)",
          textShadow: "0 2px 4px rgba(0,0,0,0.6)",
        }}
      >
        {value}
      </div>
    </div>
  )
}
