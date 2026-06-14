import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { Link, useRouter } from 'expo-router'
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import { Screen } from '@/components/ui/screen'
import { X as XIcon } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'

export default function ForgotPassword() {
  const colors = useColors()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function sendReset() {
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: 'https://foxing.app/auth/reset-password' },
    )
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
  }

  const disabled = loading || !email

  if (sent) {
    return (
      <Screen>
        <View className="flex-1 px-8 justify-center gap-4">
          <Text className="font-display text-3xl text-brand-text-light dark:text-brand-text-dark">
            Check your email
          </Text>
          <Text className="font-ui text-base text-text-secondary-light dark:text-text-secondary-dark">
            If that email is registered, a reset link is on its way. Open the
            link from any browser to set a new password, then sign back in.
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/login' as never)}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            className="rounded-xl py-4 items-center bg-brand-ui-light dark:bg-brand-ui-dark mt-4"
          >
            <Text className="font-ui-medium text-base text-text-on-brand">
              Back to sign in
            </Text>
          </Pressable>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        <View className="mb-10 items-center">
          <Text className="font-display text-3xl text-brand-text-light dark:text-brand-text-dark">
            Reset password
          </Text>
          <Text className="font-ui text-base mt-2 text-center text-text-secondary-light dark:text-text-secondary-dark">
            Enter your email and we will send a reset link.
          </Text>
        </View>

        <View className="gap-4">
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
            onPress={sendReset}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Send reset link"
            accessibilityState={{ disabled, busy: loading }}
            className="rounded-xl py-4 items-center bg-brand-ui-light dark:bg-brand-ui-dark"
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnBrand} />
            ) : (
              <Text className="font-ui-medium text-base text-text-on-brand">
                Send reset link
              </Text>
            )}
          </Pressable>

          <View className="flex-row justify-center mt-2">
            <Link href={'/(auth)/login' as never} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Back to sign in"
              >
                <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">
                  Back to sign in
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  )
}
