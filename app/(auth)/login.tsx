import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'

export default function Login() {
  const colors = useColors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signInWithEmail() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const disabled = loading || !email || !password

  return (
    <SafeAreaView className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 px-8 justify-center"
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
            placeholder="Password"
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            className="font-ui rounded-xl px-4 py-4 text-base bg-bg-surface-light dark:bg-bg-surface-dark text-text-primary-light dark:text-text-primary-dark border border-border-interactive-light dark:border-border-interactive-dark"
          />

          {error ? (
            <View className="flex-row items-center justify-center gap-2 rounded-lg px-3 py-2 bg-error-bg-light dark:bg-error-bg-dark">
              <Text className="font-ui text-error-light dark:text-error-dark">✕</Text>
              <Text className="font-ui text-center text-error-light dark:text-error-dark">
                {error}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={signInWithEmail}
            disabled={disabled}
            className="rounded-xl py-4 items-center bg-brand-ui-light dark:bg-brand-ui-dark"
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color={colors.textOnBrand} />
            ) : (
              <Text className="font-ui-medium text-base text-text-on-brand">
                Sign in
              </Text>
            )}
          </Pressable>

          <Pressable
            disabled
            className="rounded-xl py-4 items-center border border-border-interactive-light dark:border-border-interactive-dark opacity-50"
          >
            <Text className="font-ui text-base text-text-primary-light dark:text-text-primary-dark">
              Continue with Apple
            </Text>
          </Pressable>

          <View className="flex-row justify-center mt-4">
            <Text className="font-ui text-text-secondary-light dark:text-text-secondary-dark">
              New here?{' '}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <Pressable>
                <Text className="font-ui text-brand-text-light dark:text-brand-text-dark">
                  Create an account
                </Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
