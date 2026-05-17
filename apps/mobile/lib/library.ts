// Library data layer, custom shelves + ratings/reviews + re-read.
//
// SQL SCHEMA:
//
//   alter table user_books add column if not exists rating integer
//     check (rating between 1 and 5);
//   alter table user_books add column if not exists review text;
//   alter table user_books add column if not exists review_is_public boolean
//     not null default false;
//
//   create table custom_shelves (
//     id uuid primary key default gen_random_uuid(),
//     user_id uuid not null references profiles(id) on delete cascade,
//     name text not null,
//     created_at timestamptz not null default now()
//   );
//
//   create table custom_shelf_books (
//     shelf_id uuid not null references custom_shelves(id) on delete cascade,
//     book_id uuid not null references books(id) on delete cascade,
//     added_at timestamptz not null default now(),
//     primary key (shelf_id, book_id)
//   );

import { supabase } from './supabase'

export type UserBookStatus = 'reading' | 'paused' | 'want_to_read' | 'finished' | 'abandoned'

export interface CustomShelf {
  id: string
  user_id: string
  name: string
  created_at: string
}

export async function listCustomShelves(userId: string): Promise<CustomShelf[]> {
  const { data, error } = await supabase
    .from('custom_shelves')
    .select('id, user_id, name, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) {
    console.warn('[library] listCustomShelves failed:', error.message)
    return []
  }
  return ((data ?? []) as CustomShelf[])
}

export async function createCustomShelf(userId: string, name: string): Promise<CustomShelf | null> {
  const { data, error } = await supabase
    .from('custom_shelves')
    .insert({ user_id: userId, name: name.trim() })
    .select()
    .single()
  if (error) {
    console.warn('[library] createCustomShelf failed:', error.message)
    return null
  }
  return (data as CustomShelf) ?? null
}

export async function renameCustomShelf(shelfId: string, name: string): Promise<boolean> {
  const { error } = await supabase
    .from('custom_shelves')
    .update({ name: name.trim() })
    .eq('id', shelfId)
  return !error
}

export async function deleteCustomShelf(shelfId: string): Promise<boolean> {
  const { error } = await supabase.from('custom_shelves').delete().eq('id', shelfId)
  return !error
}

// Updates both the legacy whole-star `rating` (int) and the new `rating_half`
// (numeric, 0..5 in 0.5 steps) so old queries keep working during rollout.
export async function setRating(
  userBookId: string,
  rating: number | null,
): Promise<boolean> {
  const ratingHalf = rating === null ? null : Math.max(0, Math.min(5, Math.round(rating * 2) / 2))
  const ratingInt = ratingHalf === null ? null : Math.round(ratingHalf)
  const { error } = await supabase
    .from('user_books')
    .update({ rating: ratingInt, rating_half: ratingHalf })
    .eq('id', userBookId)
  if (error) console.warn('[library] setRating failed:', error.message)
  return !error
}

export async function saveReview(
  userBookId: string,
  review: string,
  reviewPublic: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from('user_books')
    .update({ review: review.slice(0, 280), review_is_public: reviewPublic })
    .eq('id', userBookId)
  if (error) console.warn('[library] saveReview failed:', error.message)
  return !error
}

// Create a fresh user_books row for the same book, a "Read again" cycle.
// Old row keeps its finished_at + rating + review so the reading log
// surfaces both reads when we render history later.
export async function startReread(userId: string, bookId: string): Promise<boolean> {
  const { error } = await supabase.from('user_books').insert({
    user_id: userId,
    book_id: bookId,
    status: 'reading',
    started_at: new Date().toISOString(),
  })
  if (error) console.warn('[library] startReread failed:', error.message)
  return !error
}
