import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Info, X as XIcon } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'

export default function Signup() {
  const colors = useColors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  async function signUp() {
    console.log('[signup] signUp() called', {
      email,
      passwordLength: password.length,
      displayName,
    })
    setLoading(true)
    setError(null)
    try {
      const emailRedirectTo = 'https://foxing.app/auth-callback'
      console.log('[signup] emailRedirectTo', emailRedirectTo)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo,
        },
      })
      console.log('[signup] signUp() response', {
        hasUser: !!data?.user,
        hasSession: !!data?.session,
        errorMessage: error?.message,
      })
      if (error) {
        setError(error.message)
        return
      }
      // Email confirmation is on: user exists but no session was established.
      // The root layout only redirects when a session appears, so without
      // this branch the screen looks frozen.
      if (data.user && !data.session) {
        setConfirmationSent(true)
      }
    } catch (err) {
      console.log('[signup] signUp() threw', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || !email || !password || !displayName

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
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password (6+ characters)"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
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
