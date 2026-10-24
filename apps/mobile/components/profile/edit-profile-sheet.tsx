import { useChangeUsername, useUpdateMe, useUsernameAvailable } from '@foxing/client'
import type * as W from '@foxing/types'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native'
import { SheetScaffold } from '@/components/ui/sheet-scaffold'
import { Field, inputStyle } from '@/components/ui/form-field'
import { X as XIcon, Check, Warning } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface Props {
  visible: boolean
  profile: W.MyProfile
  onClose: () => void
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
const USERNAME_RE = /^[a-z0-9_]{3,30}$/

type UsernameStatus = 'idle' | 'same' | 'invalid' | 'checking' | 'available' | 'taken'

// Name, username, bio and favorite genres, saved through PATCH /me (and
// /me/username when the username changed). The profile cache updates at once.
export function EditProfileSheet({ visible, profile, onClose }: Props) {
  const colors = useColors()
  const updateMe = useUpdateMe()
  const changeUsername = useChangeUsername()

  const [displayName, setDisplayName] = useState(profile.displayName ?? '')
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [genres, setGenres] = useState<string[]>(profile.favoriteGenres)
  const saving = updateMe.pending || changeUsername.pending
  const error = updateMe.error ?? changeUsername.error

  // Reset local state whenever the sheet opens with a (possibly new) profile.
  useEffect(() => {
    if (!visible) return
    setDisplayName(profile.displayName ?? '')
    setUsername(profile.username)
    setBio(profile.bio ?? '')
    setGenres(profile.favoriteGenres)
  }, [visible, profile])

  const changed = username !== profile.username
  const valid = USERNAME_RE.test(username)
  const available = useUsernameAvailable(username, visible && changed && valid)
  const usernameStatus: UsernameStatus = !changed
    ? 'same'
    : !valid
      ? 'invalid'
      : available === null
        ? 'checking'
        : available
          ? 'available'
          : 'taken'

  const toggleGenre = useCallback((slug: string) => {
    setGenres((prev) =>
      prev.includes(slug) ? prev.filter((g) => g !== slug) : [...prev, slug]
    )
  }, [])

  const canSave =
    !saving &&
    displayName.trim().length > 0 &&
    (usernameStatus === 'same' || usernameStatus === 'available') &&
    bio.length <= BIO_MAX

  const handleSave = useCallback(async () => {
    if (!canSave) return
    if (changed && !(await changeUsername.run({ username }))) return
    const ok = await updateMe.run({
      displayName: displayName.trim(),
      bio: bio.trim() || null,
      favoriteGenres: genres,
    })
    if (ok !== undefined) onClose()
  }, [canSave, changed, changeUsername, username, updateMe, displayName, bio, genres, onClose])

  const usernameMessage = () => {
    switch (usernameStatus) {
      case 'invalid':
        return { text: '3 to 30 lowercase letters, numbers, underscores', color: colors.error }
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
                    maxLength={30}
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
