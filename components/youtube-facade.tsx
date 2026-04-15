"use client"

import { useState } from "react"
import Image from "next/image"

interface YouTubeFacadeProps {
    videoId: string
    title: string
}

export function YouTubeFacade({ videoId, title }: YouTubeFacadeProps) {
    const [showVideo, setShowVideo] = useState(false)

    if (showVideo) {
        return (
            <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
            />
        )
    }

    return (
        <button
            onClick={() => setShowVideo(true)}
            className="group relative h-full w-full overflow-hidden bg-gray-100"
            aria-label={`Play video: ${title}`}
        >
            <Image
                src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                alt={title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105 opacity-80 group-hover:opacity-100"
                unoptimized // YouTube images are external
            />
            <div className="absolute inset-0 flex items-center justify-center">
                {/* YouTube official play button */}
                <svg 
                    className="h-16 w-16 transition-transform duration-300 group-hover:scale-110"
                    viewBox="0 0 68 48"
                >
                    <path 
                        className="fill-[#212121] opacity-80 group-hover:opacity-100 group-hover:fill-[#f00] transition-all" 
                        d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"
                    />
                    <path className="fill-white" d="M 45,24 27,14 27,34" />
                    </svg>
            </div>
        </button>
    )
}
