"use client"

import Image from "next/image"
import { useState } from "react"

interface NewsImageProps {
  src: string
  alt: string
  width: number
  height: number
  className?: string
  priority?: boolean
}

export function NewsImage({ src, alt, width, height, className, priority }: NewsImageProps) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div 
        className={`flex items-center justify-center bg-background ${className}`}
        style={{ width, height }}
      >
        <span className="text-gray-600 text-sm font-medium px-4 text-center">
          Imagen no disponible
        </span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized
      onError={() => setError(true)}
    />
  )
}
