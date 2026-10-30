import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { Screen } from '@/components/ui/screen'
import { X as XIcon } from 'phosphor-react-native'
import { authClient } from '@/lib/api'
import { useColors } from '@/constants/colors'

// One way in for new and returning readers: Google, Apple, or a six-digit code sent to
// their email (a new address gets an account; the username comes next, at onboarding).
// A good sign-in updates the session, and the root layout routes on from there.

const INPUT_CLASS =
  'font-ui rounded-xl px-4 py-4 text-base bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark'

type Busy = 'send' | 'verify' | 'google' | 'apple' | null

export default function Login() {
  const colors = useColors()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  async function attempt(kind: Busy, call: () => Promise<{ error: { message?: string } | null }>, fallback: string) {
    setBusy(kind)
    setError(null)
    try {
      const { error } = await call()
      if (error) setError(error.message ?? fallback)
      return !error
    } catch {
      setError(`${fallback} Check your connection and try again.`)
      return false
    } finally {
      setBusy(null)
    }
  }

  async function sendCode() {
    const address = email.trim()
    const ok = await attempt(
      'send',
      () => authClient.emailOtp.sendVerificationOtp({ email: address, type: 'sign-in' }),
      'Could not send a code.',
    )
    if (ok) {
      setSentTo(address)
      setCode('')
    }
  }

  const verify = () =>
    sentTo &&
    attempt('verify', () => authClient.signIn.emailOtp({ email: sentTo, otp: code.trim() }), 'That code did not work.')

  const social = (provider: 'google' | 'apple') =>
    attempt(provider, () => authClient.signIn.social({ provider, callbackURL: '/' }), 'Sign in was not completed.')

  const button = (label: string, onPress: () => void, disabled: boolean, loading: boolean, primary = false) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      className={
        primary
          ? 'rounded-xl py-4 items-center bg-brand-ui-light dark:bg-brand-ui-dark'
          : 'rounded-xl py-4 items-center border border-border-interactive-light dark:border-border-interactive-dark'
      }
      style={{ opacity: disabled && !loading ? 0.5 : 1 }}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.textOnBrand : colors.brandUi} />
      ) : (
        <Text
          className={
            primary
              ? 'font-ui-medium text-base text-text-on-brand'
              : 'font-ui text-base text-text-primary-light dark:text-text-primary-dark'
          }
        >
          {label}
        </Text>
      )}
    </Pressable>
  )

  return (
    <Screen>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View className="mb-12 items-center">
          <Text className="font-display text-5xl text-brand-text-light dark:text-brand-text-dark">
            Foxing
          </Text>
          <Text className="font-ui text-base mt-2 text-text-secondary-light dark:text-text-secondary-dark">
            Read the classics, with company
          </Text>
        </View>

        <View className="gap-4">
          {button('Continue with Apple', () => void social('apple'), busy !== null, busy === 'apple')}
          {button('Continue with Google', () => void social('google'), busy !== null, busy === 'google')}

          <Text className="font-ui text-center text-text-tertiary-light dark:text-text-tertiary-dark">
            or use your email
          </Text>

          {sentTo ? (
            <>
              <Text className="font-ui text-center text-text-secondary-light dark:text-text-secondary-dark">
                We sent a six-digit code to {sentTo}. It works for 15 minutes.
              </Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="Code"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                accessibilityLabel="Six-digit code"
                className={INPUT_CLASS}
              />
              {button('Sign in', () => void verify(), busy !== null || code.length !== 6, busy === 'verify', true)}
              <Pressable onPress={() => setSentTo(null)} accessibilityRole="button" className="items-center">
                <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">Use a different email</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                accessibilityLabel="Email"
                className={INPUT_CLASS}
              />
              {button('Email me a code', () => void sendCode(), busy !== null || !email.trim().includes('@'), busy === 'send', true)}
            </>
          )}

          {error ? (
            <View
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              className="flex-row items-center justify-center gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark"
            >
              <XIcon color={colors.error} size={16} />
              <Text className="font-ui text-center text-error-light dark:text-error-dark">{error}</Text>
            </View>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  )
}
