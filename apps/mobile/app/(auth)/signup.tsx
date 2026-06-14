import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Linking } from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Info, X as XIcon, Check } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,28}[a-z0-9]$/

type UsernameState =
  | { kind: 'idle' }
  | { kind: 'invalid'; reason: string }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'taken' }
  | { kind: 'error' }

function validateUsernameFormat(raw: string): { ok: true } | { ok: false; reason: string } {
  if (raw.length < 3) return { ok: false, reason: 'Username must be at least 3 characters.' }
  if (raw.length > 30) return { ok: false, reason: 'Username must be 30 characters or fewer.' }
  if (!USERNAME_RE.test(raw)) {
    return {
      ok: false,
      reason: 'Use letters, numbers, underscores, or hyphens. Cannot start or end with _ or -.',
    }
  }
  return { ok: true }
}

export default function Signup() {
  const colors = useColors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [usernameState, setUsernameState] = useState<UsernameState>({ kind: 'idle' })

  const normalizedUsername = username.trim().toLowerCase()

  useEffect(() => {
    if (normalizedUsername.length < 3) {
      setUsernameState({ kind: 'idle' })
      return
    }
    const formatCheck = validateUsernameFormat(normalizedUsername)
    if (!formatCheck.ok) {
      setUsernameState({ kind: 'invalid', reason: formatCheck.reason })
      return
    }
    setUsernameState({ kind: 'checking' })
    let cancelled = false
    const t = setTimeout(async () => {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', normalizedUsername)
        .limit(1)
        .maybeSingle()
      if (cancelled) return
      if (queryError && queryError.code !== 'PGRST116') {
        setUsernameState({ kind: 'error' })
        return
      }
      setUsernameState(data ? { kind: 'taken' } : { kind: 'available' })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [normalizedUsername])

  async function signUp() {
    if (!agreed) {
      setError('Confirm your age and agreement to the terms to continue.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const formatCheck = validateUsernameFormat(normalizedUsername)
      if (!formatCheck.ok) {
        setError(formatCheck.reason)
        return
      }
      if (usernameState.kind === 'taken') {
        setError('That username is taken. Please choose another.')
        return
      }
      const emailRedirectTo = 'https://foxing.app/auth-callback'
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            username: normalizedUsername,
          },
          emailRedirectTo,
        },
      })
      if (signUpError) {
        const msg = signUpError.message
        if (/duplicate|unique|already|conflict/i.test(msg) && /username|profile/i.test(msg)) {
          setError('That username was just taken. Please choose another.')
        } else {
          setError(msg)
        }
        return
      }
      if (data.user && !data.session) {
        setConfirmationSent(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const disabled =
    loading ||
    !agreed ||
    !email ||
    !password ||
    !displayName ||
    !username ||
    usernameState.kind === 'taken' ||
    usernameState.kind === 'checking' ||
    usernameState.kind === 'invalid'

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 px-8 justify-center"
      >
        <View className="mb-10 items-center">
          <Text className="font-display text-4xl text-brand-text-light dark:text-brand-text-dark">
            Join Foxing
          </Text>
        </View>

        {confirmationSent ? (
          <View className="gap-4 items-center">
            <View
              accessibilityLiveRegion="polite"
              className="flex-row items-center gap-2 rounded-lg px-4 py-3 bg-info-bg-light dark:bg-info-bg-dark"
            >
              <Info color={colors.info} size={18} />
              <Text className="font-ui text-center text-base text-text-primary-light dark:text-text-primary-dark flex-1">
                Check your email to confirm your account, then sign in.
              </Text>
            </View>
            <Link href="/(auth)/login" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Go to sign in"
                className="rounded-xl py-4 px-8 bg-brand-ui-light dark:bg-brand-ui-dark"
              >
                <Text className="font-ui-medium text-base text-text-on-brand">
                  Go to sign in
                </Text>
              </Pressable>
            </Link>
          </View>
        ) : (
        <View className="gap-4">
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={colors.textTertiary}
            className="font-ui rounded-xl px-4 py-4 text-base bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark"
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            className="font-ui rounded-xl px-4 py-4 text-base bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark"
          />
          <View className="gap-1">
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
              maxLength={30}
              className="font-ui rounded-xl px-4 py-4 text-base bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark"
            />
            <UsernameStatus state={usernameState} username={normalizedUsername} colors={colors} />
          </View>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password (6+ characters)"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            className="font-ui rounded-xl px-4 py-4 text-base bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark"
          />

          <View className="flex-row items-start gap-2">
            <Pressable
              onPress={() => setAgreed((a) => !a)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              accessibilityLabel="I am at least 13 and agree to the terms and privacy policy"
              className="mt-0.5 h-5 w-5 rounded items-center justify-center border border-border-interactive-light dark:border-border-interactive-dark"
              style={{ backgroundColor: agreed ? colors.brandUi : 'transparent' }}
            >
              {agreed ? <Check color={colors.textOnBrand} size={14} weight="bold" /> : null}
            </Pressable>
            <Text className="font-ui text-sm text-text-secondary-light dark:text-text-secondary-dark flex-1">
              I am at least 13 years old and agree to the{' '}
              <Text
                className="text-brand-text-light dark:text-brand-text-dark"
                onPress={() => Linking.openURL('https://foxing.app/terms')}
              >
                terms of service
              </Text>{' '}
              and{' '}
              <Text
                className="text-brand-text-light dark:text-brand-text-dark"
                onPress={() => Linking.openURL('https://foxing.app/privacy')}
              >
                privacy policy
              </Text>
              .
            </Text>
          </View>

          {error ? (
            <View
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              className="flex-row items-center justify-center gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark"
            >
              <XIcon color={colors.error} size={16} />
              <Text className="font-ui text-center text-error-light dark:text-error-dark">
                {error}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={signUp}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Create account"
            accessibilityState={{ disabled, busy: loading }}
            className="rounded-xl py-4 items-center bg-brand-ui-light dark:bg-brand-ui-dark"
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnBrand} />
            ) : (
              <Text className="font-ui-medium text-base text-text-on-brand">
                Create account
              </Text>
            )}
          </Pressable>

          <View className="flex-row justify-center mt-4">
            <Text className="font-ui text-text-secondary-light dark:text-text-secondary-dark">
              Already have an account?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable accessibilityRole="link" accessibilityLabel="Sign in">
                <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">
                  Sign in
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function UsernameStatus({
  state,
  username,
  colors,
}: {
  state: UsernameState
  username: string
  colors: ReturnType<typeof useColors>
}) {
  if (state.kind === 'idle') return null
  if (state.kind === 'invalid') {
    return (
      <Text accessibilityLiveRegion="polite" className="font-ui text-xs px-2 text-error-light dark:text-error-dark">
        {state.reason}
      </Text>
    )
  }
  if (state.kind === 'checking') {
    return (
      <View accessibilityLiveRegion="polite" className="flex-row items-center gap-1 px-2">
        <ActivityIndicator size="small" color={colors.textTertiary} />
        <Text className="font-ui text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          Checking...
        </Text>
      </View>
    )
  }
  if (state.kind === 'available') {
    return (
      <View accessibilityLiveRegion="polite" className="flex-row items-center gap-1 px-2">
        <Check color={colors.success} size={14} />
        <Text className="font-ui text-xs text-success-light dark:text-success-dark">
          {username} is available
        </Text>
      </View>
    )
  }
  if (state.kind === 'taken') {
    return (
      <View accessibilityLiveRegion="polite" className="flex-row items-center gap-1 px-2">
        <XIcon color={colors.error} size={14} />
        <Text className="font-ui text-xs text-error-light dark:text-error-dark">
          {username} is taken
        </Text>
      </View>
    )
  }
  return (
    <Text accessibilityLiveRegion="polite" className="font-ui text-xs px-2 text-text-tertiary-light dark:text-text-tertiary-dark">
      Could not check availability. Try again.
    </Text>
  )
}
