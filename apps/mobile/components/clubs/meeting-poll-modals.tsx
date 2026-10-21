import { useColors } from '@/constants/colors'
import { useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { supabase } from '@/lib/supabase'
import { CaretLeft } from 'phosphor-react-native'
import { Fonts } from '@/constants/fonts'

export function AddMeetingModal({
  visible,
  onClose,
  clubId,
  userId,
  onCreated,
}: {
  visible: boolean
  onClose: () => void
  clubId: string
  userId: string | null
  onCreated: () => void
}) {
  const colors = useColors()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [locationName, setLocationName] = useState('')
  const [locationUrl, setLocationUrl] = useState('')
  const [meetingType, setMeetingType] =
    useState<'in_person' | 'virtual' | 'hybrid'>('in_person')
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!userId || !title.trim() || !meetingDate.trim()) return
    const date = new Date(meetingDate.trim())
    if (!Number.isFinite(date.getTime())) {
      Alert.alert('Invalid date', 'Use a format like 2026-06-15T19:00')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('club_meetings').insert({
      club_id: clubId,
      created_by: userId,
      title: title.trim().slice(0, 120),
      description: description.trim() || null,
      meeting_date: date.toISOString(),
      location_name: locationName.trim() || null,
      location_url: locationUrl.trim() || null,
      meeting_type: meetingType,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Could not create', error.message)
      return
    }
    setTitle('')
    setDescription('')
    setMeetingDate('')
    setLocationName('')
    setLocationUrl('')
    setMeetingType('in_person')
    onCreated()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bgBase,
          paddingTop: 16,
        }}
      >
        <View className="flex-row items-center px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <CaretLeft color={colors.textPrimary} size={22} />
          </Pressable>
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 18,
              color: colors.textPrimary,
              marginLeft: 4,
              flex: 1,
            }}
          >
            New meeting
          </Text>
          <Pressable
            onPress={create}
            disabled={saving || !title.trim() || !meetingDate.trim()}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor:
                title.trim() && meetingDate.trim()
                  ? colors.brandUi
                  : colors.bgDisabled,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                color: colors.textOnBrand,
                fontSize: 13,
              }}
            >
              Save
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <FieldInput
            label="Title"
            value={title}
            onChange={setTitle}
            placeholder="Book club meeting"
          />
          <FieldInput
            label="Date and time (ISO)"
            value={meetingDate}
            onChange={setMeetingDate}
            placeholder="2026-06-15T19:00"
          />
          <FieldInput
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            multiline
          />
          <View className="flex-row" style={{ gap: 6 }}>
            {(['in_person', 'virtual', 'hybrid'] as const).map((t) => {
              const active = meetingType === t
              return (
                <Pressable
                  key={t}
                  onPress={() => setMeetingType(t)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.brandUi : colors.borderSubtle,
                    backgroundColor: active ? colors.brandSubtle : colors.bgBase,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: active ? colors.brandSubtleText : colors.textSecondary,
                      textTransform: 'capitalize',
                    }}
                  >
                    {t.replace('_', ' ')}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          <FieldInput
            label="Location name (optional)"
            value={locationName}
            onChange={setLocationName}
          />
          <FieldInput
            label="Location URL (optional)"
            value={locationUrl}
            onChange={setLocationUrl}
            placeholder="https://meet.google.com/..."
          />
        </ScrollView>
      </View>
    </Modal>
  )
}

export function AddPollModal({
  visible,
  onClose,
  clubId,
  userId,
  onCreated,
}: {
  visible: boolean
  onClose: () => void
  clubId: string
  userId: string | null
  onCreated: () => void
}) {
  const colors = useColors()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState<string[]>(['', ''])
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!userId || !title.trim()) return
    const filled = options.map((o) => o.trim()).filter(Boolean)
    if (filled.length < 2) {
      Alert.alert('Need at least 2 options')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('club_polls')
      .insert({
        club_id: clubId,
        created_by: userId,
        title: title.trim().slice(0, 200),
        description: description.trim() || null,
        poll_type: 'single',
      })
      .select('id')
      .single()
    if (error || !data) {
      setSaving(false)
      Alert.alert('Could not create', error?.message ?? 'Try again.')
      return
    }
    const pollId = (data as { id: string }).id
    const optionRows = filled.map((label, idx) => ({
      poll_id: pollId,
      label: label.slice(0, 120),
      position: idx,
    }))
    const { error: optErr } = await supabase
      .from('club_poll_options')
      .insert(optionRows)
    setSaving(false)
    if (optErr) {
      Alert.alert('Could not create options', optErr.message)
      return
    }
    setTitle('')
    setDescription('')
    setOptions(['', ''])
    onCreated()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View style={{ flex: 1, backgroundColor: colors.bgBase, paddingTop: 16 }}>
        <View className="flex-row items-center px-3 py-2">
          <Pressable onPress={onClose} hitSlop={10} className="p-2">
            <CaretLeft color={colors.textPrimary} size={22} />
          </Pressable>
          <Text
            style={{
              fontFamily: Fonts.displayBold,
              fontSize: 18,
              color: colors.textPrimary,
              marginLeft: 4,
              flex: 1,
            }}
          >
            New poll
          </Text>
          <Pressable
            onPress={create}
            disabled={saving || !title.trim()}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: title.trim() ? colors.brandUi : colors.bgDisabled,
            }}
          >
            <Text
              style={{
                fontFamily: Fonts.uiMedium,
                color: colors.textOnBrand,
                fontSize: 13,
              }}
            >
              Save
            </Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <FieldInput
            label="Question"
            value={title}
            onChange={setTitle}
            placeholder="Which book next?"
          />
          <FieldInput
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            multiline
          />
          <Text
            style={{
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Options
          </Text>
          {options.map((opt, idx) => (
            <View key={idx} className="flex-row items-center" style={{ gap: 8 }}>
              <TextInput
                value={opt}
                onChangeText={(t) => {
                  const next = [...options]
                  next[idx] = t
                  setOptions(next)
                }}
                placeholder={`Option ${idx + 1}`}
                placeholderTextColor={colors.textTertiary}
                style={{
                  flex: 1,
                  fontFamily: Fonts.body,
                  fontSize: 14,
                  color: colors.textPrimary,
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              />
              {options.length > 2 ? (
                <Pressable
                  onPress={() =>
                    setOptions(options.filter((_, i) => i !== idx))
                  }
                  hitSlop={10}
                  style={{ padding: 6 }}
                >
                  <Text
                    style={{
                      fontFamily: Fonts.ui,
                      fontSize: 18,
                      color: colors.textTertiary,
                    }}
                  >
                    ×
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {options.length < 5 ? (
            <Pressable
              onPress={() => setOptions([...options, ''])}
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.borderSubtle,
              }}
            >
              <Text
                style={{
                  fontFamily: Fonts.uiMedium,
                  fontSize: 12,
                  color: colors.brandText,
                }}
              >
                Add option
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  const colors = useColors()
  return (
    <View>
      <Text
        style={{
          fontFamily: Fonts.uiMedium,
          fontSize: 11,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 4,
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        multiline={multiline}
        style={{
          fontFamily: Fonts.body,
          fontSize: 14,
          color: colors.textPrimary,
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 8,
          minHeight: multiline ? 60 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  )
}
