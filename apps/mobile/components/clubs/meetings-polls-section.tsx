import { useClosePoll, useRsvp, useVotePoll } from '@foxing/client'
import type * as W from '@foxing/types'
import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { Plus } from 'phosphor-react-native'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { ClubMeetingCard } from './club-meeting-card'
import { ClubPollCard } from './club-poll-card'
import { AddMeetingModal, AddPollModal } from './meeting-poll-modals'

// The club page's upcoming meetings and open polls. RSVPs and votes patch the cached
// club page, so counts move as soon as you tap.
export function MeetingsPollsSection({
  page,
  signedIn,
}: {
  page: W.ClubPage
  signedIn: boolean
}) {
  const colors = useColors()
  const clubId = page.club.id
  const canModerate = page.isModerator
  const rsvp = useRsvp()
  const votePoll = useVotePoll()
  const closePoll = useClosePoll()
  const [addMeetingOpen, setAddMeetingOpen] = useState(false)
  const [addPollOpen, setAddPollOpen] = useState(false)
  const now = Date.now()
  const meetings = page.meetings
    .filter((m) => !m.isCancelled && (m.endDate ?? m.meetingDate) >= now)
    .sort((a, b) => a.meetingDate - b.meetingDate)
    .slice(0, 5)
  const polls = page.polls.filter((p) => !p.isClosed).slice(0, 3)

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
          <ClubMeetingCard
            key={m.id}
            m={m}
            canRsvp={signedIn && page.isMember}
            onRsvp={(meetingId, status) => rsvp.fire({ clubId, meetingId, status })}
          />
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
        polls.map((p) => (
          <View key={p.id}>
            <ClubPollCard
              p={p}
              onVote={(pollId, optionId) =>
                page.isMember && votePoll.fire({ clubId, pollId, ranks: [optionId] })
              }
            />
            {canModerate ? (
              <Pressable
                onPress={() => closePoll.fire({ clubId, pollId: p.id })}
                accessibilityRole="button"
                className="self-end mb-2"
                hitSlop={6}
              >
                <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: colors.brandText }}>
                  Close poll
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}

      <AddMeetingModal
        visible={addMeetingOpen}
        onClose={() => setAddMeetingOpen(false)}
        clubId={clubId}
        onCreated={() => setAddMeetingOpen(false)}
      />
      <AddPollModal
        visible={addPollOpen}
        onClose={() => setAddPollOpen(false)}
        clubId={clubId}
        onCreated={() => setAddPollOpen(false)}
      />
    </View>
  )
}

