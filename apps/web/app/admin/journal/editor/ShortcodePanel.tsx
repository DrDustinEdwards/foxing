'use client'

export function ShortcodePanel() {
  const rows: Array<[string, string]> = [
    ['## Heading', 'H2 section heading'],
    ['### Heading', 'H3 subheading'],
    ['**text**', 'Bold'],
    ['_text_', 'Italic'],
    ['`code`', 'Inline code'],
    ['[text](url)', 'Link'],
    ['> text', 'Blockquote'],
    ['---', 'Horizontal rule'],
    [':::tip / :::warning / :::note / :::danger', 'Callout block'],
    [':::pullquote', 'Pull quote'],
    [':::toggle[Header]', 'Collapsible section'],
    ['::youtube[videoId]', 'YouTube embed'],
    ['::bookmark[url]', 'Bookmark card'],
    ['::postlink[slug]', 'Internal post link (or type @ in editor)'],
    ['![alt](url)', 'Image (or use toolbar Image button)'],
  ]
  return (
    <details className="rounded-md border border-border-subtle bg-bg-surface p-2">
      <summary className="flex cursor-pointer items-center justify-between px-2 py-1 font-dm-sans text-xs text-text-secondary">
        <span>Shortcodes</span>
        <span aria-hidden="true" className="font-dm-mono text-xs">
          +
        </span>
      </summary>
      <table className="mt-2 w-full border-collapse text-left font-dm-sans text-xs">
        <tbody>
          {rows.map(([code, what]) => (
            <tr
              key={code}
              className="border-t border-border-subtle align-top"
            >
              <td className="px-2 py-1 font-dm-mono text-xs text-text-primary">
                {code}
              </td>
              <td className="px-2 py-1 text-text-tertiary">{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
