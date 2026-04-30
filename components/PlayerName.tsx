'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'

interface Props {
  name: string
  commanderImageUrl?: string | null
  className?: string
}

export default function PlayerName({ name, commanderImageUrl, className = '' }: Props) {
  const [visible, setVisible] = useState(false)
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>()

  if (!commanderImageUrl) {
    return <span className={className}>{name}</span>
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
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none block">
          <Image
            src={commanderImageUrl}
            alt={`Commandant de ${name}`}
            width={180}
            height={251}
            className="rounded-xl shadow-xl border border-dc-gold/20"
            unoptimized={commanderImageUrl.includes('?')}
          />
        </span>
      )}
    </span>
  )
}
