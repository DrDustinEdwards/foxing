import Link from 'next/link'
import { SearchIcon } from '@/components/icons'

interface SearchBarProps {
  placeholder?: string
  defaultValue?: string
}

export function SearchBar({
  placeholder = 'Search books, people, clubs',
  defaultValue,
}: SearchBarProps) {
  return (
    <form
      action="/search"
      method="get"
      className="flex w-full items-center gap-2 rounded-lg border border-border-interactive bg-bg-surface px-3 py-2"
    >
      <span className="text-text-tertiary">
        <SearchIcon size={18} />
      </span>
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        defaultValue={defaultValue}
        autoComplete="off"
        className="flex-1 bg-transparent font-dm-sans text-base text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
      <Link
        href="/search"
        className="hidden font-dm-sans text-xs text-text-tertiary md:inline"
      >
        Press Enter
      </Link>
    </form>
  )
}
