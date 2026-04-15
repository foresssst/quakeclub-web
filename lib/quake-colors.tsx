import type React from "react"

// Light-theme adapted Quake colors (darkened for readability on white backgrounds)
export const quakeColorMap: Record<string, string> = {
  "0": "#5a6d7d", // Gray-blue (darkened)
  "1": "#CC0000", // Red (darkened)
  "2": "#008800", // Green (darkened from #00FF00)
  "3": "#998800", // Yellow (darkened from #FFFF00)
  "4": "#2855CC", // Blue (darkened)
  "5": "#2B8F83", // Cyan/Teal (darkened from #53DCCD)
  "6": "#8A2BE2", // Purple
  "7": "",        // White → inherit from parent (light theme compatible)
  "8": "#5a6d7d", // Gray-blue (same as ^0)
  "9": "#606060", // Gray (darkened)
}

/**
 * Ensures a hex color is readable on a light/white background.
 * Darkens colors that are too bright (high luminance).
 * Returns "" (inherit) for near-white colors.
 */
function ensureReadableOnLight(hexColor: string): string {
  if (!hexColor) return ""
  const hex = hexColor.replace("#", "")
  if (hex.length !== 6) return hexColor

  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  // Calculate perceived brightness (ITU-R BT.601)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  // Near-white colors → inherit from parent
  if (luminance > 0.85) return ""

  // Bright colors → darken by 50%
  if (luminance > 0.55) {
    const factor = 0.55 / luminance
    const dr = Math.round(r * factor)
    const dg = Math.round(g * factor)
    const db = Math.round(b * factor)
    return `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}`
  }

  return hexColor
}

/**
 * Strips Quake color codes from a string for database storage
 * Handles both basic codes (^0-^7) and extended codes (^xRGB)
 * Returns a clean string without color codes
 */
export function stripQuakeColors(text: string): string {
  if (!text) return text

  let result = ""
  let i = 0

  while (i < text.length) {
    if (text[i] === "^" && i + 1 < text.length) {
      // Check for basic color codes (^0-^7)
      if (/[0-9]/.test(text[i + 1])) {
        i += 2 // Skip the color code
      }
      // Check for extended color codes (^x followed by 3 hex chars)
      else if (text[i + 1] === "x" && i + 4 < text.length && /[0-9A-Fa-f]{3}/.test(text.slice(i + 2, i + 5))) {
        i += 5 // Skip the extended color code
      }
      // Invalid color code, include the ^ character
      else {
        result += text[i]
        i++
      }
    } else {
      result += text[i]
      i++
    }
  }

  // Return cleaned string, fallback to original if result is empty
  return result.trim() || text.trim()
}

/**
 * Clean username for database storage
 * Strips color codes and provides fallback for empty names
 */
export function cleanUsername(name: string, steamId?: string): string {
  const cleaned = stripQuakeColors(name || "")

  // If cleaned name is empty or just whitespace, provide fallback
  if (!cleaned || cleaned.length === 0) {
    return steamId ? `Player_${steamId.slice(-8)}` : "Unknown"
  }

  return cleaned
}

export function parseQuakeColors(text: string): React.ReactNode {
  if (!text) return text

  const parts: React.ReactNode[] = []
  let currentColor = "" // empty = inherit from parent CSS
  let currentText = ""
  let i = 0

  while (i < text.length) {
    if (text[i] === "^" && i + 1 < text.length) {
      // Check for basic color codes (^0-^7)
      if (/[0-9]/.test(text[i + 1])) {
        // Save current text with current color
        if (currentText) {
          parts.push(
            currentColor
              ? <span key={parts.length} style={{ color: currentColor }}>{currentText}</span>
              : <span key={parts.length}>{currentText}</span>,
          )
          currentText = ""
        }
        // Update color (empty string = inherit from parent)
        currentColor = quakeColorMap[text[i + 1]] ?? ""
        i += 2
      }
      // Check for extended color codes (^x followed by 3 hex chars for RGB)
      else if (text[i + 1] === "x" && i + 4 < text.length && /[0-9A-Fa-f]{3}/.test(text.slice(i + 2, i + 5))) {
        // Save current text with current color
        if (currentText) {
          parts.push(
            currentColor
              ? <span key={parts.length} style={{ color: currentColor }}>{currentText}</span>
              : <span key={parts.length}>{currentText}</span>,
          )
          currentText = ""
        }
        // Parse RGB from 3-char hex (e.g., ^xF00 = #FF0000)
        const r = text[i + 2]
        const g = text[i + 3]
        const b = text[i + 4]
        const rawColor = `#${r}${r}${g}${g}${b}${b}`
        currentColor = ensureReadableOnLight(rawColor)
        i += 5
      }
      // Invalid color code, treat ^ as regular character
      else {
        currentText += text[i]
        i++
      }
    } else {
      currentText += text[i]
      i++
    }
  }

  // Add remaining text
  if (currentText) {
    parts.push(
      currentColor
        ? <span key={parts.length} style={{ color: currentColor }}>{currentText}</span>
        : <span key={parts.length}>{currentText}</span>,
    )
  }

  return parts.length > 0 ? <>{parts}</> : text
}

/**
 * Counts the visible characters in a Quake color-coded string
 * Ignores color codes and only counts actual visible characters
 */
export function countQuakeChars(text: string): number {
  if (!text) return 0

  let count = 0
  let i = 0

  while (i < text.length) {
    if (text[i] === "^" && i + 1 < text.length) {
      // Check for basic color codes (^0-^7)
      if (/[0-9]/.test(text[i + 1])) {
        i += 2 // Skip the color code
      }
      // Check for extended color codes (^x followed by 3 hex chars)
      else if (text[i + 1] === "x" && i + 4 < text.length && /[0-9A-Fa-f]{3}/.test(text.slice(i + 2, i + 5))) {
        i += 5 // Skip the extended color code
      }
      // Invalid color code, count the ^ as a character
      else {
        count++
        i++
      }
    } else {
      count++
      i++
    }
  }

  return count
}
