'use client'

import Link from 'next/link'
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
          a({ href, children, ...rest }) {
            const isExternal =
              typeof href === 'string' && /^https?:\/\//.test(href)
            if (isExternal) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...rest}
                >
                  {children}
                </a>
              )
            }
            return <Link href={href ?? ''} {...rest}>{children}</Link>
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
