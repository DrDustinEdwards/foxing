import { useAccountClubs, useDeleteAccount } from '@foxing/client'
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { Field, inputStyle } from '@/components/ui/form-field'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { authClient, queryClient } from '@/lib/api'

// Account changes that go through Better Auth (email, linked Apple and Google accounts)
// or /api/v1/account (deletion).

function FormSheet({
  visible,
  title,
  action,
  canSubmit,
  pending,
  done,
  error,
  destructive,
  onSubmit,
  onClose,
  children,
}: {
  visible: boolean
  title: string
  action: string
  canSubmit: boolean
  pending: boolean
  done: string | null
  error: string | null
  destructive?: boolean
  onSubmit: () => void
  onClose: () => void
  children: ReactNode
}) {
  const colors = useColors()
  const actionColor = !canSubmit || pending ? colors.textDisabled : destructive ? colors.error : colors.brandText
  return (
    <SheetScaffold
      visible={visible}
      onClose={onClose}
      variant="bottom"
      maxHeight="92%"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
      header={
        <View className="flex-row items-center justify-between mb-5 px-5">
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ fontFamily: Fonts.ui, color: colors.textSecondary }}>Cancel</Text>
          </Pressable>
          <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary }}>{title}</Text>
          <Pressable onPress={onSubmit} disabled={!canSubmit || pending} hitSlop={8} accessibilityRole="button">
            {pending ? (
              <ActivityIndicator color={colors.brandUi} size="small" />
            ) : (
              <Text style={{ fontFamily: Fonts.uiMedium, color: actionColor }}>{action}</Text>
            )}
          </Pressable>
        </View>
      }
    >
      {children}
      {done ? (
        <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.success }} accessibilityLiveRegion="polite">
          {done}
        </Text>
      ) : null}
      {error ? (
        <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.error }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </SheetScaffold>
  )
}

/** Runs one Better Auth call with the pending/done/error state a sheet shows. */
function useAuthAction() {
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = async (call: () => Promise<{ error: { message?: string } | null }>, ok: string, fallback: string) => {
    setPending(true)
    setDone(null)
    setError(null)
    try {
      const res = await call()
      if (res.error) setError(res.error.message ?? fallback)
      else setDone(ok)
      return !res.error
    } catch {
      setError(`${fallback} Check your connection and try again.`)
      return false
    } finally {
      setPending(false)
    }
  }
  const reset = () => {
    setDone(null)
    setError(null)
  }
  return { pending, done, error, run, reset }
}

export function ChangeEmailSheet({ visible, email, onClose }: { visible: boolean; email: string; onClose: () => void }) {
  const colors = useColors()
  const [next, setNext] = useState('')
  const action = useAuthAction()
  const close = () => {
    setNext('')
    action.reset()
    onClose()
  }
  const submit = async () => {
    const ok = await action.run(
      () => authClient.changeEmail({ newEmail: next.trim(), callbackURL: 'foxing://settings' }),
      'Check your inbox to confirm.',
      'Could not change your email.',
    )
    if (ok) setNext('')
  }
  return (
    <FormSheet
      visible={visible}
      title="Email"
      action="Change"
      canSubmit={next.trim().includes('@')}
      onSubmit={submit}
      onClose={close}
      {...action}
    >
      <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
        Your account email is {email}. Changing it sends a confirmation link to your current address.
      </Text>
      <Field label="New email">
        <TextInput
          value={next}
          onChangeText={setNext}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          style={inputStyle(colors)}
        />
      </Field>
    </FormSheet>
  )
}

const PROVIDERS = [
  { id: 'apple', label: 'Apple' },
  { id: 'google', label: 'Google' },
] as const

/** Which of Apple and Google are linked to this account, with a button to link the rest.
 *  Signing in with a provider never joins an existing account by email address, so a
 *  reader who started with an emailed code links Apple or Google here. */
export function LinkedAccounts({ Row }: { Row: (props: { label: string; onPress: () => void }) => ReactNode }) {
  const colors = useColors()
  const accounts = useQuery({
    queryKey: ['auth', 'accounts'],
    queryFn: async () => {
      const { data, error } = await authClient.listAccounts()
      if (error) throw new Error(error.message)
      return data.map((a) => a.providerId)
    },
  })
  const [error, setError] = useState<string | null>(null)
  const link = async (provider: 'apple' | 'google') => {
    setError(null)
    const { error } = await authClient.linkSocial({ provider, callbackURL: '/settings' })
    if (error) setError(error.message ?? 'Could not link that account.')
    else void accounts.refetch()
  }
  return (
    <>
      {PROVIDERS.map((p) =>
        accounts.data?.includes(p.id) ? (
          <Text key={p.id} style={{ fontFamily: Fonts.ui, fontSize: 14, color: colors.textSecondary, padding: 12 }}>
            {p.label} is linked
          </Text>
        ) : (
          <Row key={p.id} label={`Link ${p.label}`} onPress={() => void link(p.id)} />
        ),
      )}
      {error ? (
        <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.error, padding: 12 }} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </>
  )
}

const CONFIRM_PHRASE = 'delete my account'

/** Clubs the reader created pass to a member they pick first, so leaving does not
 *  delete everyone else's discussion. */
export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors()
  const clubs = useAccountClubs()
  const del = useDeleteAccount()
  const [confirm, setConfirm] = useState('')
  const [choice, setChoice] = useState<Record<string, string | null>>({})
  const owned = clubs.data ?? []
  const successorOf = (club: (typeof owned)[number]) =>
    club.clubId in choice ? choice[club.clubId] : (club.suggested ?? club.candidates[0]?.userId ?? null)

  const submit = async () => {
    // A club with no other members goes with the account; the server needs no answer for it.
    const successors = Object.fromEntries(
      owned.filter((c) => c.candidates.length > 0).map((c) => [c.clubId, successorOf(c)]),
    )
    if (!(await del.run({ successors }))) return
    await authClient.signOut()
    queryClient.clear()
  }

  const chip = (selected: boolean, label: string, onPress: () => void, danger = false) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="px-3 py-2 rounded-full border"
      style={{
        borderColor: selected ? (danger ? colors.error : colors.brandUi) : colors.borderSubtle,
        backgroundColor: selected ? colors.brandSubtle : 'transparent',
      }}
    >
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: danger && selected ? colors.error : colors.textPrimary }}>
        {label}
      </Text>
    </Pressable>
  )

  return (
    <FormSheet
      visible={visible}
      title="Delete account"
      action="Delete"
      destructive
      canSubmit={confirm.trim().toLowerCase() === CONFIRM_PHRASE && !clubs.isPending}
      pending={del.pending}
      done={null}
      error={del.error ?? (clubs.error ? 'Could not load your clubs.' : null)}
      onSubmit={submit}
      onClose={onClose}
    >
      <Text style={{ fontFamily: Fonts.body, fontSize: 14, color: colors.textSecondary, marginBottom: 16 }}>
        This permanently removes your profile, library, highlights, notes, goals and posts. It cannot be undone.
      </Text>
      {owned.map((club) => (
        <View key={club.clubId} style={{ marginBottom: 16 }}>
          <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary, marginBottom: 6 }}>
            {club.name}
          </Text>
          {club.candidates.length === 0 ? (
            <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
              No other members, so it is deleted with your account.
            </Text>
          ) : (
            <View className="flex-row flex-wrap" style={{ gap: 6 }} accessibilityRole="radiogroup">
              {club.candidates.map((m) =>
                chip(successorOf(club) === m.userId, m.role === 'moderator' ? `${m.name} (moderator)` : m.name, () =>
                  setChoice((c) => ({ ...c, [club.clubId]: m.userId })),
                ),
              )}
              {chip(successorOf(club) === null, 'Nobody: delete the club', () =>
                setChoice((c) => ({ ...c, [club.clubId]: null })), true,
              )}
            </View>
          )}
        </View>
      ))}
      <Field label={`Type "${CONFIRM_PHRASE}" to confirm`}>
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
          autoCorrect={false}
          style={inputStyle(colors)}
        />
      </Field>
    </FormSheet>
  )
}
