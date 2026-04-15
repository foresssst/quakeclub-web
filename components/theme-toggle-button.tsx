"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

type ThemeToggleButtonProps = {
  className?: string
  showLabel?: boolean
  label?: string
}

export function ThemeToggleButton({ className, showLabel, label }: ThemeToggleButtonProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const isDark = resolvedTheme === "dark"

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className={cn(
        "qc-theme-toggle group",
        isDark ? "qc-theme-toggle--dark" : "qc-theme-toggle--light",
        className
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 32 32"
        fill="currentColor"
        strokeLinecap="round"
        aria-hidden="true"
        className="qc-toggle-svg"
      >
        <clipPath id="qc-theme-cutout">
          <path
            d={isDark
              ? "M-12 5h30a1 1 0 0 0 9 13v24h-39Z"
              : "M0-5h30a1 1 0 0 0 9 13v24H0Z"
            }
          />
        </clipPath>
        <g clipPath="url(#qc-theme-cutout)">
          <circle cx="16" cy="16" r="9.34" />
          <g
            stroke="currentColor"
            strokeWidth="1.5"
            className={cn(
              "qc-toggle-rays",
              isDark && "qc-toggle-rays--hidden"
            )}
          >
            <path d="M16 5.5v-4" />
            <path d="M16 30.5v-4" />
            <path d="M1.5 16h4" />
            <path d="M26.5 16h4" />
            <path d="m23.4 8.6 2.8-2.8" />
            <path d="m5.7 26.3 2.9-2.9" />
            <path d="m5.8 5.8 2.8 2.8" />
            <path d="m23.4 23.4 2.9 2.9" />
          </g>
        </g>
      </svg>
      {showLabel && (
        <span className="qc-theme-toggle__label">
          {label || (isDark ? "Tema oscuro" : "Tema claro")}
        </span>
      )}
    </button>
  )
}
