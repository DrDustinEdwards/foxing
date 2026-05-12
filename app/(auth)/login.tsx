import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'

export default function Login() {
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

  return (
    <SafeAreaView className="flex-1 bg-[#1A1208]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 px-8 justify-center"
      >
        <View className="mb-12 items-center">
          <Text className="text-5xl font-serif" style={{ color: '#8B6914' }}>
            Foxing
          </Text>
          <Text className="text-base mt-2" style={{ color: '#C4973A' }}>
            Read the classics, with company
          </Text>
        </View>

        <View className="gap-4">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#8B6914"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            className="rounded-xl px-4 py-4 text-base"
            style={{ backgroundColor: '#2A1F0F', color: '#E8D5B0' }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#8B6914"
            secureTextEntry
            className="rounded-xl px-4 py-4 text-base"
            style={{ backgroundColor: '#2A1F0F', color: '#E8D5B0' }}
          />

          {error ? (
            <Text className="text-center" style={{ color: '#D32F2F' }}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={signInWithEmail}
            disabled={loading || !email || !password}
            className="rounded-xl py-4 items-center"
            style={{ backgroundColor: '#8B6914', opacity: loading || !email || !password ? 0.5 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#FDF8F0" />
            ) : (
              <Text className="text-base font-semibold" style={{ color: '#FDF8F0' }}>
                Sign in
              </Text>
            )}
          </Pressable>

          <Pressable
            disabled
            className="rounded-xl py-4 items-center border"
            style={{ borderColor: '#3D2B1F', opacity: 0.5 }}
          >
            <Text className="text-base" style={{ color: '#E8D5B0' }}>
              Continue with Apple
            </Text>
          </Pressable>

          <View className="flex-row justify-center mt-4">
            <Text style={{ color: '#E8D5B0' }}>New here? </Text>
            <Link href="/(auth)/signup" asChild>
              <Pressable>
                <Text style={{ color: '#C4973A' }}>Create an account</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
