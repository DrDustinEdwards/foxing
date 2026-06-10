import Image from 'next/image'
import { truncate } from '@foxing/utils'
import { Card } from '@/components/ui/card'
import type { Book, ReadingList } from '@/types/database'

interface ListCardProps {
  list: Pick<ReadingList, 'id' | 'title' | 'description'>
  covers: Array<Pick<Book, 'cover_url' | 'title'>>
  bookCount: number
  likeCount?: number
  creator?: { username: string; display_name: string }
}

export function ListCard({
  list,
  covers,
  bookCount,
  likeCount = 0,
  creator,
}: ListCardProps) {
  const [primary, ...secondary] = covers.slice(0, 3)
  return (
    <Card variant="entity" href={`/my-lists/${list.id}`} className="gap-3 p-4">
      <div className="grid h-32 grid-cols-3 gap-1 overflow-hidden rounded">
        <div className="relative col-span-2 row-span-2 bg-bg-sunken">
          {primary?.cover_url && (
            <Image
              src={primary.cover_url}
              alt={primary.title}
              fill
              sizes="(max-width: 768px) 50vw, 200px"
              className="object-cover"
            />
          )}
        </div>
        <div className="flex flex-col gap-1">
          {secondary.map((book, i) => (
            <div key={i} className="relative h-full w-full bg-bg-sunken">
              {book.cover_url && (
                <Image
                  src={book.cover_url}
                  alt={book.title}
                  fill
                  sizes="100px"
                  className="object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-fraunces text-base text-text-primary">
          {list.title}
        </h3>
        {list.description && (
          <p className="font-dm-sans text-[13px] text-text-secondary">
            {truncate(list.description, 90)}
          </p>
        )}
        <p className="font-dm-sans text-xs text-text-tertiary">
          {creator ? `@${creator.username} · ` : ''}
          {bookCount} books · {likeCount} likes
        </p>
      </div>
    </Card>
  )
}
