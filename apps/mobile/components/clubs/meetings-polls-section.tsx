import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native'
import {
  CalendarBlank,
  ChartBar,
  Plus,
  CaretLeft,
  GoogleLogo,
} from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface MeetingRow {
  id: string
  title: string
  description: string | null
  meeting_date: string
  end_date: string | null
  location_name: string | null
  location_url: string | null
  meeting_type: 'in_person' | 'virtual' | 'hybrid'
  is_cancelled: boolean
  book: { title: string; cover_url: string | null } | null
  rsvp_counts: { going: number; maybe: number; not_going: number }
  user_rsvp: 'going' | 'maybe' | 'not_going' | null
}

interface PollOption {
  id: string
  label: string
  book_id: string | null
  position: number | null
  book: { title: string; cover_url: string | null } | null
  vote_count: number
}

interface PollRow {
  id: string
  title: string
  description: string | null
  poll_type: string
  closes_at: string | null
  is_closed: boolean
  options: PollOption[]
  user_vote: string | null
}

function pickOne<T>(v: unknown): T | null {
  if (!v) return null
  if (Array.isArray(v)) return (v[0] as T | undefined) ?? null
  return v as T
}

function formatMeetingTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface Props {
  clubId: string
  canModerate: boolean
}

export function MeetingsPollsSection({ clubId, canModerate }: Props) {
  const colors = useColors()
  const [meetings, setMeetings] = useState<MeetingRow[]>([])
  const [polls, setPolls] = useState<PollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [addMeetingOpen, setAddMeetingOpen] = useState(false)
  const [addPollOpen, setAddPollOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUserId(user?.id ?? null)

    const nowIso = new Date().toISOString()
    const [meetingsRes, pollsRes] = await Promise.all([
      supabase
        .from('club_meetings')
        .select(
          'id, title, description, meeting_date, end_date, location_name, location_url, meeting_type, is_cancelled, book:book_id(title, cover_url)',
        )
        .eq('club_id', clubId)
        .eq('is_cancelled', false)
        .gte('meeting_date', nowIso)
        .order('meeting_date', { ascending: true })
        .limit(5),
      supabase
        .from('club_polls')
        .select(
          'id, title, description, poll_type, closes_at, is_closed, options:club_poll_options(id, label, book_id, position, book:book_id(title, cover_url))',
        )
        .eq('club_id', clubId)
        .eq('is_closed', false)
        .order('created_at', { ascending: false })
        .limit(3),
    ])

    const meetingRows = ((meetingsRes.data ?? []) as unknown) as Array<
      Record<string, unknown>
    >
    const meetingIds = meetingRows.map((m) => String(m.id))
    const rsvpCounts = new Map<
      string,
      { going: number; maybe: number; not_going: number }
    >()
    const myRsvp = new Map<string, 'going' | 'maybe' | 'not_going'>()
    if (meetingIds.length > 0) {
      const { data: rsvpRows } = await supabase
        .from('club_meeting_rsvps')
        .select('meeting_id, user_id, status')
        .in('meeting_id', meetingIds)
      for (const r of (rsvpRows as
        | Array<{
            meeting_id: string
            user_id: string
            status: 'going' | 'maybe' | 'not_going'
          }>
        | null) ?? []) {
        const c = rsvpCounts.get(r.meeting_id) ?? {
          going: 0,
          maybe: 0,
          not_going: 0,
        }
        c[r.status] += 1
        rsvpCounts.set(r.meeting_id, c)
        if (user && r.user_id === user.id) {
          myRsvp.set(r.meeting_id, r.status)
        }
      }
    }
    setMeetings(
      meetingRows.map((m) => ({
        id: String(m.id),
        title: String(m.title),
        description: (m.description as string | null) ?? null,
        meeting_date: String(m.meeting_date),
        end_date: (m.end_date as string | null) ?? null,
        location_name: (m.location_name as string | null) ?? null,
        location_url: (m.location_url as string | null) ?? null,
        meeting_type: (m.meeting_type as MeetingRow['meeting_type']) ?? 'in_person',
        is_cancelled: Boolean(m.is_cancelled),
        book: pickOne(m.book),
        rsvp_counts: rsvpCounts.get(String(m.id)) ?? {
          going: 0,
          maybe: 0,
          not_going: 0,
        },
        user_rsvp: myRsvp.get(String(m.id)) ?? null,
      })),
    )

    const pollRows = ((pollsRes.data ?? []) as unknown) as Array<
      Record<string, unknown>
    >
    const pollIds = pollRows.map((p) => String(p.id))
    const voteCounts = new Map<string, number>()
    const myVote = new Map<string, string>()
    if (pollIds.length > 0) {
      const { data: voteRows } = await supabase
        .from('club_poll_votes')
        .select('poll_id, option_id, user_id')
        .in('poll_id', pollIds)
      for (const v of (voteRows as
        | Array<{ poll_id: string; option_id: string; user_id: string }>
        | null) ?? []) {
        voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1)
        if (user && v.user_id === user.id) {
          myVote.set(v.poll_id, v.option_id)
        }
      }
    }
    setPolls(
      pollRows.map((p) => {
        const optsRaw = (p.options as Array<Record<string, unknown>> | null) ?? []
        const options: PollOption[] = optsRaw
          .map((o): PollOption => ({
            id: String(o.id),
            label: String(o.label),
            book_id: (o.book_id as string | null) ?? null,
            position: (o.position as number | null) ?? null,
            book: pickOne<{ title: string; cover_url: string | null }>(o.book),
            vote_count: voteCounts.get(String(o.id)) ?? 0,
          }))
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        return {
          id: String(p.id),
          title: String(p.title),
          description: (p.description as string | null) ?? null,
          poll_type: String(p.poll_type ?? 'single'),
          closes_at: (p.closes_at as string | null) ?? null,
          is_closed: Boolean(p.is_closed),
          options,
          user_vote: myVote.get(String(p.id)) ?? null,
        }
      }),
    )
    setLoading(false)
  }, [clubId])

  useEffect(() => {
    void load()
  }, [load])

  async function rsvp(meetingId: string, status: 'going' | 'maybe' | 'not_going') {
    if (!userId) return
    const { error } = await supabase
      .from('club_meeting_rsvps')
      .upsert(
        { meeting_id: meetingId, user_id: userId, status },
        { onConflict: 'meeting_id,user_id' },
      )
    if (error) {
      Alert.alert('Could not RSVP', error.message)
      return
    }
    void load()
  }

  async function vote(pollId: string, optionId: string) {
    if (!userId) return
    await supabase
      .from('club_poll_votes')
      .delete()
      .eq('poll_id', pollId)
      .eq('user_id', userId)
    const { error } = await supabase
      .from('club_poll_votes')
      .insert({ poll_id: pollId, option_id: optionId, user_id: userId })
    if (error) {
      Alert.alert('Could not vote', error.message)
      return
    }
    void load()
  }

  if (loading) {
    return (
      <View style={{ paddingVertical: 16 }}>
        <ActivityIndicator color={colors.brandUi} />
      </View>
    )
  }

  return (
    <View style={{ marginTop: 16 }}>
      <View
        className="flex-row items-center justify-between"
        style={{ marginBottom: 10 }}
      >
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Meetings
        </Text>
        {canModerate ? (
          <Pressable onPress={() => setAddMeetingOpen(true)} hitSlop={10}>
            <Plus color={colors.brandUi} size={18} weight="bold" />
          </Pressable>
        ) : null}
      </View>
      {meetings.length === 0 ? (
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 13,
            color: colors.textTertiary,
            marginBottom: 16,
          }}
        >
          No upcoming meetings.
        </Text>
      ) : (
        meetings.map((m) => (
          <View
            key={m.id}
            className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <View className="flex-row items-start" style={{ gap: 10 }}>
              <CalendarBlank
                color={colors.textSecondary}
                size={18}
                weight="regular"
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: Fonts.uiMedium,
                    fontSize: 14,
                    color: colors.textPrimary,
                  }}
                >
                  {m.title}
                </Text>
                <Text
                  style={{
                    fontFamily: Fonts.mono,
                    fontSize: 11,
                    color: colors.textTertiary,
                    marginTop: 2,
                  }}
                >
                  {formatMeetingTime(m.meeting_date)}
                  {m.location_name ? ` · ${m.location_name}` : ''}
                </Text>
                <View
                  className="flex-row flex-wrap"
                  style={{ gap: 6, marginTop: 6 }}
                >
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: colors.bgSunken,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.mono,
                        fontSize: 11,
                        color: colors.textTertiary,
                        textTransform: 'capitalize',
                      }}
                    >
                      {m.meeting_type.replace('_', ' ')}
                    </Text>
                  </View>
                </View>
                {m.location_url &&
                m.location_url.includes('meet.google.com') ? (
                  <Pressable
                    onPress={() => {
                      if (m.location_url) void Linking.openURL(m.location_url)
                    }}
                    className="flex-row items-center"
                    style={{ gap: 6, marginTop: 8 }}
                  >
                    <GoogleLogo color={colors.brandText} size={14} />
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 12,
                        color: colors.brandText,
                      }}
                    >
                      Join on Google Meet
                    </Text>
                  </Pressable>
                ) : m.location_url ? (
                  <Pressable
                    onPress={() => {
                      if (m.location_url) void Linking.openURL(m.location_url)
                    }}
                    style={{ marginTop: 8 }}
                  >
                    <Text
                      style={{
                        fontFamily: Fonts.uiMedium,
                        fontSize: 12,
                        color: colors.brandText,
                      }}
                    >
                      Join link
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {m.book ? (
              <View
                className="flex-row items-center"
                style={{ gap: 8, marginTop: 10 }}
              >
                <View
                  style={{
                    width: 32,
                    height: 48,
                    borderRadius: 3,
                    overflow: 'hidden',
                    backgroundColor: colors.bgSunken,
                  }}
                >
                  {m.book.cover_url ? (
                    <Image
                      source={{ uri: m.book.cover_url }}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : null}
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.ui,
                    fontSize: 12,
                    color: colors.textSecondary,
                  }}
                  numberOfLines={2}
                >
                  {m.book.title}
                </Text>
              </View>
            ) : null}

            {userId ? (
              <View
                className="flex-row"
                style={{ gap: 6, marginTop: 12 }}
              >
                {(['going', 'maybe', 'not_going'] as const).map((s) => {
                  const active = m.user_rsvp === s
                  const label =
                    s === 'going'
                      ? 'Going'
                      : s === 'maybe'
                        ? 'Maybe'
                        : "Can't go"
                  return (
                    <Pressable
                      key={s}
                      onPress={() => void rsvp(m.id, s)}
                      style={{
                        flex: 1,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? colors.brandUi : colors.borderSubtle,
                        backgroundColor: active
                          ? colors.brandSubtle
                          : colors.bgBase,
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Fonts.uiMedium,
                          fontSize: 12,
                          color: active ? colors.brandSubtleText : colors.textSecondary,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            ) : null}
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 11,
                color: colors.textTertiary,
                marginTop: 6,
              }}
            >
              {m.rsvp_counts.going} going · {m.rsvp_counts.maybe} maybe
            </Text>
          </View>
        ))
      )}

      <View
        className="flex-row items-center justify-between"
        style={{ marginTop: 16, marginBottom: 10 }}
      >
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 11,
            color: colors.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          Polls
        </Text>
        {canModerate ? (
          <Pressable onPress={() => setAddPollOpen(true)} hitSlop={10}>
            <Plus color={colors.brandUi} size={18} weight="bold" />
          </Pressable>
        ) : null}
      </View>
      {polls.length === 0 ? (
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 13,
            color: colors.textTertiary,
          }}
        >
          No active polls.
        </Text>
      ) : (
        polls.map((p) => {
          const total = p.options.reduce((sum, o) => sum + o.vote_count, 0)
          const hasVoted = p.user_vote !== null
          return (
            <View
              key={p.id}
              className="p-3 mb-2 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
            >
              <View className="flex-row items-start" style={{ gap: 10 }}>
                <ChartBar
                  color={colors.textSecondary}
                  size={18}
                  weight="regular"
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 14,
                      color: colors.textPrimary,
                    }}
                  >
                    {p.title}
                  </Text>
                  {p.description ? (
                    <Text
                      style={{
                        fontFamily: Fonts.body,
                        fontSize: 12,
                        color: colors.textSecondary,
                        marginTop: 4,
                      }}
                    >
                      {p.description}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={{ marginTop: 10 }}>
                {p.options.map((o) => {
                  const pct = total > 0 ? Math.round((o.vote_count / total) * 100) : 0
                  const voted = p.user_vote === o.id
                  return (
                    <Pressable
                      key={o.id}
                      onPress={() => {
                        if (!hasVoted) void vote(p.id, o.id)
                      }}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: voted ? colors.brandUi : colors.borderSubtle,
                        backgroundColor: voted ? colors.brandSubtle : colors.bgBase,
                        marginBottom: 6,
                      }}
                    >
                      <View
                        className="flex-row items-center"
                        style={{ gap: 8 }}
                      >
                        {o.book ? (
                          <View
                            style={{
                              width: 26,
                              height: 38,
                              borderRadius: 3,
                              overflow: 'hidden',
                              backgroundColor: colors.bgSunken,
                            }}
                          >
                            {o.book.cover_url ? (
                              <Image
                                source={{ uri: o.book.cover_url }}
                                style={{ width: '100%', height: '100%' }}
                              />
                            ) : null}
                          </View>
                        ) : null}
                        <Text
                          style={{
                            flex: 1,
                            fontFamily: Fonts.uiMedium,
                            fontSize: 13,
                            color: voted ? colors.brandSubtleText : colors.textPrimary,
                          }}
                          numberOfLines={2}
                        >
                          {o.book?.title ?? o.label}
                        </Text>
                        {hasVoted ? (
                          <Text
                            style={{
                              fontFamily: Fonts.mono,
                              fontSize: 11,
                              color: voted ? colors.brandSubtleText : colors.textTertiary,
                            }}
                          >
                            {pct}% · {o.vote_count}
                          </Text>
                        ) : null}
                      </View>
                      {hasVoted ? (
                        <View
                          style={{
                            marginTop: 6,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: colors.bgSunken,
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              height: 4,
                              width: `${pct}%`,
                              backgroundColor: voted ? colors.brandUi : colors.brandSubtle,
                            }}
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
              <Text
                style={{
                  fontFamily: Fonts.mono,
                  fontSize: 11,
                  color: colors.textTertiary,
                  marginTop: 6,
                }}
              >
                {total} vote{total === 1 ? '' : 's'}
                {p.closes_at ? ` · closes ${formatMeetingTime(p.closes_at)}` : ''}
              </Text>
            </View>
          )
        })
      )}

      <AddMeetingModal
        visible={addMeetingOpen}
        onClose={() => setAddMeetingOpen(false)}
        clubId={clubId}
        userId={userId}
        onCreated={() => {
          setAddMeetingOpen(false)
          void load()
        }}
      />
      <AddPollModal
        visible={addPollOpen}
        onClose={() => setAddPollOpen(false)}
        clubId={clubId}
        userId={userId}
        onCreated={() => {
          setAddPollOpen(false)
          void load()
        }}
      />
    </View>
  )
}

function AddMeetingModal({
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

function AddPollModal({
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
