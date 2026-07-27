import { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import {
  X as XIcon,
  Check,
  Camera,
  Warning,
} from 'phosphor-react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { supabase } from '@/lib/supabase'

export interface EditableProfile {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  favorite_genres: string[] | null
}

interface Props {
  visible: boolean
  profile: EditableProfile
  onClose: () => void
  onSaved: () => void
}

const GENRES: Array<{ slug: string; label: string }> = [
  { slug: 'fiction', label: 'Fiction' },
  { slug: 'mystery', label: 'Mystery' },
  { slug: 'romance', label: 'Romance' },
  { slug: 'science-fiction', label: 'Sci-Fi' },
  { slug: 'fantasy', label: 'Fantasy' },
  { slug: 'horror', label: 'Horror' },
  { slug: 'historical', label: 'Historical' },
  { slug: 'philosophy', label: 'Philosophy' },
  { slug: 'poetry', label: 'Poetry' },
  { slug: 'drama', label: 'Drama' },
  { slug: 'adventure', label: 'Adventure' },
  { slug: 'classics', label: 'Classics' },
  { slug: 'biography', label: 'Biography' },
  { slug: 'essays', label: 'Essays' },
]

const BIO_MAX = 160
const USERNAME_RE = /^[a-z0-9_]{3,20}$/

type UsernameStatus = 'idle' | 'same' | 'invalid' | 'checking' | 'available' | 'taken'

// Exported so the avatar tap on the profile screen can reuse the same flow.
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    copyToCacheDirectory: true,
    multiple: false,
  })
  if (pick.canceled) return null
  const asset = pick.assets?.[0]
  if (!asset?.uri) return null

  const mime = asset.mimeType || 'image/jpeg'
  const extFromMime = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  const path = `${userId}/avatar.${extFromMime}`

  const response = await fetch(asset.uri)
  const blob = await response.blob()

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: mime })
  if (upErr) throw upErr

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  // Bust any HTTP cache so the new image actually shows up.
  const url = `${data.publicUrl}?t=${Date.now()}`

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (profErr) throw profErr

  return url
}

export function EditProfileSheet({ visible, profile, onClose, onSaved }: Props) {
  const colors = useColors()

  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [username, setUsername] = useState(profile.username ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [genres, setGenres] = useState<string[]>(profile.favorite_genres ?? [])
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('same')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset local state whenever the sheet opens with a (possibly new) profile.
  useEffect(() => {
    if (!visible) return
    setDisplayName(profile.display_name ?? '')
    setUsername(profile.username ?? '')
    setBio(profile.bio ?? '')
    setGenres(profile.favorite_genres ?? [])
    setAvatarUrl(profile.avatar_url)
    setUsernameStatus('same')
    setError(null)
  }, [visible, profile])

  // Debounced uniqueness check. Only fires when the user actually changed the
  // username, typing back to the original is "same" not "taken".
  useEffect(() => {
    if (!visible) return
    const initial = profile.username ?? ''
    if (username === initial) {
      setUsernameStatus('same')
      return
    }
    if (!USERNAME_RE.test(username)) {
      setUsernameStatus('invalid')
      return
    }
    setUsernameStatus('checking')
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', profile.id)
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 400)
    return () => clearTimeout(handle)
  }, [username, profile.username, profile.id, visible])

  const toggleGenre = useCallback((slug: string) => {
    setGenres((prev) =>
      prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]
    )
  }, [])

  const handleAvatarUpload = useCallback(async () => {
    try {
      setUploading(true)
      setError(null)
      const url = await pickAndUploadAvatar(profile.id)
      if (url) setAvatarUrl(url)
    } catch (e: any) {
      setError(e?.message ?? 'Avatar upload failed')
    } finally {
      setUploading(false)
    }
  }, [profile.id])

  const canSave =
    !saving &&
    displayName.trim().length > 0 &&
    (usernameStatus === 'same' || usernameStatus === 'available') &&
    bio.length <= BIO_MAX

  const handleSave = useCallback(async () => {
    if (!canSave) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        favorite_genres: genres,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    onSaved()
    onClose()
  }, [canSave, displayName, username, bio, genres, profile.id, onSaved, onClose])

  const usernameMessage = () => {
    switch (usernameStatus) {
      case 'invalid':
        return { text: '3 to 20 lowercase letters, numbers, underscores', color: colors.error }
      case 'checking':
        return { text: 'Checking…', color: colors.textTertiary }
      case 'available':
        return { text: 'Available', color: colors.success }
      case 'taken':
        return { text: 'Already taken', color: colors.error }
      default:
        return null
    }
  }
  const msg = usernameMessage()

  const initial = (displayName || username || '?')[0]?.toUpperCase() ?? '?'

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
          <Text style={{ fontFamily: Fonts.display, fontSize: 18, color: colors.textPrimary }}>
            Edit Profile
          </Text>
          <Pressable onPress={handleSave} disabled={!canSave} hitSlop={8}>
            {saving ? (
              <ActivityIndicator color={colors.brandUi} size="small" />
            ) : (
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  color: canSave ? colors.brandText : colors.textDisabled,
                }}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>
      }
    >
            {/* Avatar */}
            <View className="items-center mb-6">
              <Pressable onPress={handleAvatarUpload} disabled={uploading}>
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    overflow: 'hidden',
                    backgroundColor: colors.brandSubtle,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <Text
                      style={{ fontFamily: Fonts.display, fontSize: 36, color: colors.brandSubtleText }}
                    >
                      {initial}
                    </Text>
                  )}
                  {uploading ? (
                    <View
                      style={{
                        position: 'absolute',
                        inset: 0 as any,
                        backgroundColor: colors.overlay,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ActivityIndicator color={colors.textOnBrand} />
                    </View>
                  ) : null}
                </View>
                <View
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.brandUi,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: colors.bgElevated,
                  }}
                >
                  <Camera color={colors.textOnBrand} size={16} />
                </View>
              </Pressable>
              <Pressable onPress={handleAvatarUpload} disabled={uploading} hitSlop={8} className="mt-3">
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>
                  Change photo
                </Text>
              </Pressable>
            </View>

            {/* Display name */}
            <Field label="Display name">
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={colors.textTertiary}
                maxLength={40}
                style={inputStyle(colors)}
              />
            </Field>

            {/* Username */}
            <Field label="Username">
              <View>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    value={username}
                    onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                    style={{ ...inputStyle(colors), paddingLeft: 32, paddingRight: 36 }}
                  />
                  <Text
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: 0,
                      bottom: 0,
                      textAlignVertical: 'center',
                      lineHeight: 44,
                      fontFamily: Fonts.mono,
                      color: colors.textTertiary,
                    }}
                  >
                    @
                  </Text>
                  {usernameStatus === 'available' || usernameStatus === 'same' ? (
                    <View style={{ position: 'absolute', right: 12, top: 12 }}>
                      <Check color={colors.success} size={18} />
                    </View>
                  ) : usernameStatus === 'taken' || usernameStatus === 'invalid' ? (
                    <View style={{ position: 'absolute', right: 12, top: 12 }}>
                      <Warning color={colors.error} size={18} />
                    </View>
                  ) : usernameStatus === 'checking' ? (
                    <View style={{ position: 'absolute', right: 12, top: 12 }}>
                      <ActivityIndicator color={colors.textTertiary} size="small" />
                    </View>
                  ) : null}
                </View>
                {msg ? (
                  <Text
                    style={{ fontFamily: Fonts.ui, fontSize: 12, color: msg.color, marginTop: 6 }}
                  >
                    {msg.text}
                  </Text>
                ) : null}
              </View>
            </Field>

            {/* Bio */}
            <Field label="Bio">
              <View>
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="A few words about your reading life"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  maxLength={BIO_MAX}
                  style={{
                    ...inputStyle(colors),
                    minHeight: 88,
                    paddingTop: 12,
                    paddingBottom: 12,
                    fontFamily: Fonts.body,
                    textAlignVertical: 'top',
                  }}
                />
                <Text
                  style={{
                    fontFamily: Fonts.mono,
                    fontSize: 11,
                    color: bio.length === BIO_MAX ? colors.warning : colors.textTertiary,
                    marginTop: 6,
                    textAlign: 'right',
                  }}
                >
                  {bio.length}/{BIO_MAX}
                </Text>
              </View>
            </Field>

            {/* Genres */}
            <Field label="Favorite genres">
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -4 }}>
                {GENRES.map((g) => {
                  const selected = genres.includes(g.slug)
                  return (
                    <Pressable
                      key={g.slug}
                      onPress={() => toggleGenre(g.slug)}
                      style={{
                        margin: 4,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        borderWidth: 1,
                        backgroundColor: selected ? colors.brandSubtle : 'transparent',
                        borderColor: selected ? colors.brandUi : colors.borderSubtle,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 13,
                          color: selected ? colors.brandSubtleText : colors.textSecondary,
                        }}
                      >
                        {g.label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </Field>

            {error ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.errorBg,
                  marginTop: 8,
                }}
              >
                <XIcon color={colors.error} size={16} />
                <Text style={{ flex: 1, fontFamily: Fonts.ui, fontSize: 13, color: colors.error }}>
                  {error}
                </Text>
              </View>
            ) : null}
    </SheetScaffold>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors()
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 12,
          color: colors.textTertiary,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      {children}
    </View>
  )
}

function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    fontFamily: Fonts.ui,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  } as const
}
