import { useState } from 'react'
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signUp() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        username: email.split('@')[0],
        display_name: displayName || email.split('@')[0],
      })
      if (profileError) setError(profileError.message)
    }
    setLoading(false)
  }

  return (
    <SafeAreaView className="flex-1 bg-[#1A1208]">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 px-8 justify-center"
      >
        <View className="mb-10 items-center">
          <Text className="text-4xl font-serif" style={{ color: '#8B6914' }}>
            Join Foxing
          </Text>
          <Text className="text-base mt-2 text-center" style={{ color: '#C4973A' }}>
            Start your reading journey
          </Text>
        </View>

        <View className="gap-4">
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor="#8B6914"
            className="rounded-xl px-4 py-4 text-base"
            style={{ backgroundColor: '#2A1F0F', color: '#E8D5B0' }}
          />
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
            placeholder="Password (6+ characters)"
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
            onPress={signUp}
            disabled={loading || !email || !password || !displayName}
            className="rounded-xl py-4 items-center"
            style={{ backgroundColor: '#8B6914', opacity: loading || !email || !password || !displayName ? 0.5 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#FDF8F0" />
            ) : (
              <Text className="text-base font-semibold" style={{ color: '#FDF8F0' }}>
                Create account
              </Text>
            )}
          </Pressable>

          <View className="flex-row justify-center mt-4">
            <Text style={{ color: '#E8D5B0' }}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <Text style={{ color: '#C4973A' }}>Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
