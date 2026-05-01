'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface Props {
  name: string
  commanderImageUrl?: string | null
  className?: string
  variant?: 'hover' | 'inline'
}

export default function PlayerName({ name, commanderImageUrl, className = '', variant = 'hover' }: Props) {
  const [visible, setVisible] = useState(false)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>()

  if (!commanderImageUrl) {
    return <span className={className}>{name}</span>
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`}>
        <span
          className="relative shrink-0 w-10 rounded-md overflow-visible border border-dc-gold/30 shadow-sm cursor-pointer"
          style={{ aspectRatio: '63/88' }}
          onMouseEnter={() => { clearTimeout(hideTimeout.current); setVisible(true) }}
          onMouseLeave={() => { hideTimeout.current = setTimeout(() => setVisible(false), 150) }}
          onClick={() => setVisible((v) => !v)}
        >
          <Image
            src={commanderImageUrl}
            alt=""
            width={80}
            height={112}
            className="w-full h-full object-cover rounded-md"
            unoptimized
          />
          {visible && (
            <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none block w-[220px]">
              <Image
                src={commanderImageUrl}
                alt={`Commandant de ${name}`}
                width={220}
                height={308}
                className="rounded-xl shadow-xl border border-dc-gold/40 w-[220px] h-auto"
                unoptimized
              />
            </span>
          )}
        </span>
        <span>{name}</span>
      </span>
    )
  }

  return (
    <span
      className={`relative inline-block cursor-pointer ${className}`}
      onMouseEnter={() => { clearTimeout(hideTimeout.current); setVisible(true) }}
      onMouseLeave={() => { hideTimeout.current = setTimeout(() => setVisible(false), 150) }}
      onClick={() => setVisible((v) => !v)}
    >
      <span className="border-b border-dashed border-dc-gold/60">{name}</span>
      {visible && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none block w-[220px]">
          <Image
            src={commanderImageUrl}
            alt={`Commandant de ${name}`}
            width={220}
            height={308}
            className="rounded-xl shadow-xl border border-dc-gold/20 w-[220px] h-auto"
            unoptimized
          />
        </span>
      )}
    </span>
  )
}
