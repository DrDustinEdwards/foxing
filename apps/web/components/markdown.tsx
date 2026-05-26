'use client'

import Link from 'next/link'
import type { Ref } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders markdown body content. Wraps in `.prose-foxing` so headings,
 * paragraphs, lists, and blockquotes pick up the design-system tokens.
 * Links open in a new tab when external; internal links stay in-app.
 */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-foxing">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children, ref, ...rest }) {
            const anchorRef = ref as Ref<HTMLAnchorElement>
            const isExternal =
              typeof href === 'string' && /^https?:\/\//.test(href)
            if (isExternal) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  ref={anchorRef}
                  {...rest}
                >
                  {children}
                </a>
              )
            }
            return (
              <Link href={href ?? ''} ref={anchorRef} {...rest}>
                {children}
              </Link>
            )
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
