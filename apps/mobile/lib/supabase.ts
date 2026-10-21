// Supabase has been removed from the Foxing stack. The backend now lives on
// Cloudflare (Workers + D1 + R2), reached through the /api/v1 surface.
//
// This module preserves the `supabase` singleton so the ~90 call sites that
// still import it keep resolving while the mobile data layer is ported to
// /api/v1. It is typed `any` (the least-friction stand-in for the untyped
// supabase-js surface) and throws at runtime so a missed migration is loud
// rather than silent. Do NOT reintroduce @supabase/supabase-js here.

const REASON =
  'Supabase was removed from the mobile app. Migrate this call to the Cloudflare /api/v1 backend.'

// Runtime: answer every property access and call with another proxy so fluent
// chains build, and reject when awaited so a missed migration surfaces loudly.
function makeChain(): any {
  const base = () => undefined
  return new Proxy(base, {
    get(_t, prop) {
      if (prop === 'then') {
        return (_resolve: unknown, reject: unknown) => {
          const err = new Error(REASON)
          if (typeof reject === 'function') {
            ;(reject as (e: unknown) => void)(err)
            return
          }
          throw err
        }
      }
      return makeChain()
    },
    apply() {
      return makeChain()
    },
  })
}

export const supabase: any = makeChain()
