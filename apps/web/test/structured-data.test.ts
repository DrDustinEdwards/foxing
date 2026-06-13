import { describe, expect, it } from 'vitest'
import { safeJsonLd, bookJsonLd, profileJsonLd } from '@/lib/structured-data'

// Regression for the Pass 1 stored-XSS fix: user-controlled values containing
// </script> must never be able to break out of a JSON-LD script element.
describe('safeJsonLd', () => {
  it('escapes every < so </script> cannot terminate the element', () => {
    const out = safeJsonLd({ name: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('<')
    expect(out).toContain('\\u003c/script')
  })

  it('round-trips back to the original data', () => {
    const data = { name: 'a</script>b', nested: { v: '<img src=x>' } }
    expect(JSON.parse(safeJsonLd(data))).toEqual(data)
  })
})

describe('bookJsonLd', () => {
  it('escapes attacker-controlled book fields', () => {
    const out = bookJsonLd({
      id: 'abc',
      title: '</script><script>alert(1)</script>',
      author: 'Mallory',
      description: '<svg onload=alert(1)>',
    })
    expect(out).not.toContain('<')
    const parsed = JSON.parse(out)
    expect(parsed['@type']).toBe('Book')
    expect(parsed.name).toBe('</script><script>alert(1)</script>')
  })
})

describe('profileJsonLd', () => {
  it('escapes attacker-controlled profile fields', () => {
    const out = profileJsonLd({
      username: 'mallory',
      display_name: '</script>',
      bio: '<b>bold</b>',
    })
    expect(out).not.toContain('<')
    expect(JSON.parse(out).name).toBe('</script>')
  })
})
