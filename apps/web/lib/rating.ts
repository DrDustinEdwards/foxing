/**
 * Foxing stores user book ratings in user_books.rating_half as an integer
 * from 1 to 10, where 2 = 1 star, 7 = 3.5 stars, 10 = 5 stars.
 *
 * The StarRating component accepts a decimal 0-5 value (with 0.5 steps).
 * These helpers convert between the storage and display representations.
 */

export function halfStarToDecimal(rating: number | null): number | null {
  if (rating === null || rating === undefined) return null
  if (!Number.isFinite(rating)) return null
  return rating / 2
}

export function decimalToHalfStar(value: number | null): number | null {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return null
  return Math.round(value * 2)
}

export function halfStarToDisplay(rating: number | null): string {
  const decimal = halfStarToDecimal(rating)
  if (decimal === null) return '-'
  return Number.isInteger(decimal)
    ? decimal.toFixed(0)
    : decimal.toFixed(1)
}
