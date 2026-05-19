import Link from 'next/link'
import { FoxMark } from '@/components/ui/fox-mark'

interface FooterLink {
  href: string
  label: string
  external?: boolean
}

interface FooterColumn {
  heading: string
  links: FooterLink[]
}

const COLUMNS: FooterColumn[] = [
  {
    heading: 'Foxing',
    links: [
      { href: '/about', label: 'About' },
      { href: '/journal', label: 'Journal' },
      { href: '/pricing', label: 'Pricing' },
      { href: '#download', label: 'Download the app' },
    ],
  },
  {
    heading: 'Read',
    links: [
      { href: '/books', label: 'All Books' },
      { href: '/book-clubs', label: 'Book Clubs' },
      { href: '/book-of-the-month', label: 'Book of the Month' },
      { href: '/awards', label: 'Award Winners' },
      { href: '/challenges', label: 'Reading Challenges' },
    ],
  },
  {
    heading: 'Community',
    links: [
      { href: '/people', label: 'People' },
      { href: '/clubs', label: 'Public Clubs' },
      { href: '/lists', label: 'Reading Lists' },
      { href: '/quotes', label: 'Quotes' },
    ],
  },
  {
    heading: 'Using Foxing',
    links: [
      { href: '/features', label: 'What Foxing does' },
      { href: '/guide', label: 'Web guide' },
      { href: '/app-guide', label: 'App guide' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
    ],
  },
]

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t border-border-subtle bg-bg-surface">
      <div className="mx-auto w-full max-w-page px-6 py-12 md:px-12">
        <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(5,1fr)]">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2 font-fraunces text-xl text-brand-ui">
              <FoxMark size={28} />
              Foxing
            </span>
            <span className="font-source-serif-4 italic text-text-tertiary">
              reading, together.
            </span>
          </div>
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="mb-3 font-dm-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
                {column.heading}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-dm-sans text-sm text-text-secondary hover:text-text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-border-subtle">
        <div className="mx-auto flex max-w-page flex-col gap-1 px-6 py-4 md:flex-row md:items-center md:justify-between md:px-12">
          <p className="font-dm-mono text-[11px] text-text-tertiary">
            © {year} Foxing · Built for readers
          </p>
          <p className="font-dm-mono text-[11px] text-text-tertiary">
            No ads. No algorithms selling you books.
          </p>
        </div>
      </div>
    </footer>
  )
}
