'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUserId } from '@/lib/nav-user'
import { FOXING_BASE_URL } from '@/lib/metadata'

type ActionResult = { ok: true } | { ok: false; error: string }

const NAME_RE = /^.{2,80}$/
const URL_RE = /^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}.*$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function randomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

function emailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? ''
}

async function sendVerificationEmail(
  email: string,
  authorName: string,
  link: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Foxing <noreply@foxing.app>',
        to: email,
        subject: 'Verify your Foxing author claim',
        html: `<p>Hi ${authorName},</p><p>Click the link below to verify your author claim on Foxing.</p><p><a href="${link}">${link}</a></p><p>If you did not start this claim, ignore this email.</p>`,
      }),
    })
  } catch {
    // Non-fatal: claim still exists for admin review.
  }
}

export async function submitAuthorClaim(
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const authorName = String(formData.get('author_name') ?? '').trim().slice(0, 80)
  const websiteRaw = String(formData.get('website_url') ?? '').trim().slice(0, 200)
  const contactEmail = String(formData.get('contact_email') ?? '').trim().slice(0, 200).toLowerCase()
  if (!NAME_RE.test(authorName)) {
    return { ok: false, error: 'Author name must be 2 to 80 characters.' }
  }
  if (!EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: 'Enter a valid contact email.' }
  }
  let website: string | null = null
  if (websiteRaw) {
    if (!URL_RE.test(websiteRaw)) {
      return { ok: false, error: 'Website must be a valid URL.' }
    }
    const siteDomain = domainOf(websiteRaw)
    const mailDomain = emailDomain(contactEmail)
    if (siteDomain && mailDomain && !mailDomain.endsWith(siteDomain)) {
      return {
        ok: false,
        error:
          'Contact email must be on the same domain as the website you list.',
      }
    }
    website = websiteRaw
  }

  const sb = createClient()
  const { data: existing } = await sb
    .from('author_claims')
    .select('id, status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const prior = existing as { id: string; status: string } | null
  if (prior?.status === 'verified') {
    return { ok: false, error: 'You are already a verified author.' }
  }

  const token = randomToken()
  const { error } = await sb.from('author_claims').upsert(
    {
      id: prior?.id,
      user_id: userId,
      author_name: authorName,
      website_url: website,
      contact_email: contactEmail,
      verification_token: token,
      status: 'pending',
      reviewed_at: null,
    },
    { onConflict: 'id' },
  )
  if (error) return { ok: false, error: error.message }

  const verifyLink = `${FOXING_BASE_URL}/api/author/verify/${token}`
  await sendVerificationEmail(contactEmail, authorName, verifyLink)

  revalidatePath('/settings')
  return { ok: true }
}

export async function reviewAuthorClaim(
  formData: FormData,
): Promise<ActionResult> {
  const claimId = String(formData.get('claim_id') ?? '').trim()
  const decision = String(formData.get('decision') ?? '').trim()
  if (!claimId || (decision !== 'verified' && decision !== 'rejected')) {
    return { ok: false, error: 'Invalid input.' }
  }
  const userId = await getAuthedUserId()
  if (!userId) return { ok: false, error: 'Sign in required.' }
  const admin = createAdminClient()
  const { data: me } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (!(me as { is_admin: boolean | null } | null)?.is_admin) {
    return { ok: false, error: 'Admin only.' }
  }
  const { data: claim, error } = await admin
    .from('author_claims')
    .update({
      status: decision as 'verified' | 'rejected',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', claimId)
    .select('user_id')
    .single()
  if (error || !claim) return { ok: false, error: error?.message ?? 'Update failed.' }
  await admin
    .from('profiles')
    .update({ is_verified_author: decision === 'verified' })
    .eq('id', (claim as { user_id: string }).user_id)
  revalidatePath('/admin/author-claims')
  revalidatePath('/settings')
  return { ok: true }
}
