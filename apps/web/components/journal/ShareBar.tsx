'use client'

import { useState } from 'react'
import { CheckIcon, LinkIcon } from '@/components/journal/Icons'

interface ShareBarProps {
  title: string
  url: string
}

export function ShareBar({ title, url }: ShareBarProps) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)
  const xHref = `https://x.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`

  return (
    <div className="mt-6 flex items-center gap-3 border-b border-border-subtle pb-4">
      <span className="font-dm-mono text-[0.6875rem] uppercase tracking-[0.06em] text-text-tertiary">
        Share
      </span>
      <a
        href={xHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        className="inline-flex items-center gap-1.5 font-dm-mono text-[0.8125rem] text-text-tertiary no-underline transition-colors hover:text-text-primary"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10.93.5h2.12L8.36 6.14 14 13.5h-3.89L6.72 8.87 2.76 13.5H.64l5.02-5.95L0 .5h3.99l3.06 4.56L10.93.5Zm-.74 11.7h1.17L3.9 1.69H2.65l7.54 10.51Z" />
        </svg>
        X
      </a>
      <a
        href={liHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className="inline-flex items-center gap-1.5 font-dm-mono text-[0.8125rem] text-text-tertiary no-underline transition-colors hover:text-text-primary"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12.833 0H1.163C.52 0 0 .507 0 1.133v11.734C0 13.493.52 14 1.163 14h11.67C13.48 14 14 13.493 14 12.867V1.133C14 .507 13.48 0 12.833 0ZM4.153 11.9H2.073V5.25h2.08v6.65ZM3.113 4.34a1.205 1.205 0 1 1 0-2.41 1.205 1.205 0 0 1 0 2.41ZM11.9 11.9H9.82V8.667c0-.777-.014-1.777-1.083-1.777-1.083 0-1.25.846-1.25 1.72V11.9H5.41V5.25h1.997v.91h.028c.277-.524.956-1.077 1.966-1.077 2.103 0 2.492 1.384 2.492 3.184V11.9H11.9Z" />
        </svg>
        LinkedIn
      </a>
      <button
        type="button"
        onClick={copyLink}
        aria-label="Copy link"
        className="inline-flex cursor-pointer items-center gap-1.5 font-dm-mono text-[0.8125rem] text-text-tertiary transition-colors hover:text-text-primary"
      >
        {copied ? (
          <CheckIcon className="text-success" />
        ) : (
          <LinkIcon />
        )}
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
