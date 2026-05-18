import Link from 'next/link'

const ROW_ONE = [
  { href: '/discover', label: 'Discover' },
  { href: '/books', label: 'Books' },
  { href: '/clubs', label: 'Clubs' },
  { href: '/book-clubs', label: 'Celebrity Picks' },
  { href: '/book-of-the-month', label: 'Book of the Month' },
] as const

const ROW_TWO = [
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/journal', label: 'Journal' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const

export function Footer() {
  return (
    <footer className="border-t border-border-subtle bg-bg-surface">
      <div className="mx-auto flex w-full max-w-page flex-col gap-6 px-6 py-8 md:flex-row md:items-start md:justify-between md:px-12">
        <div className="flex flex-col gap-1">
          <span className="font-fraunces text-xl text-brand-ui">
            <span aria-hidden="true">🦊 </span>
            Foxing
          </span>
          <span className="font-source-serif-4 italic text-text-tertiary">
            reading, together.
          </span>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {ROW_ONE.map((link) => (
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
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {ROW_TWO.map((link) => (
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
      </div>
      <div className="border-t border-border-subtle">
        <p className="mx-auto max-w-page px-6 py-3 font-dm-mono text-[11px] text-text-tertiary md:px-12">
          © {new Date().getFullYear()} Foxing
        </p>
      </div>
    </footer>
  )
}
