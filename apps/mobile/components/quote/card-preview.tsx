import { View, Text, Image } from 'react-native'
import { Star, Highlighter, BookOpen, UsersThree } from 'phosphor-react-native'
import { Fonts } from '@/constants/fonts'
import type { CardType, TemplateDef } from './types'

interface CardPreviewProps {
  cardType: CardType
  template: TemplateDef
  passage: string
  bookTitle: string
  author: string
  coverUrl: string | null
  rating: number
  daysToRead: number | null
  highlightCount: number | null
  progress: number | null
  clubName: string | null
  memberCount: number | null
  deepLink: string
}

export function CardPreview(props: CardPreviewProps) {
  const { cardType, template, bookTitle, author, deepLink } = props
  const baseStyle = {
    aspectRatio: 4 / 5,
    borderRadius: 14,
    overflow: 'hidden' as const,
    backgroundColor: template.background,
    padding: 24,
    borderWidth: template.borderColor ? 1 : 0,
    borderColor: template.borderColor ?? 'transparent',
  }

  if (cardType === 'finished') return <FinishedCard {...props} baseStyle={baseStyle} />
  if (cardType === 'reading') return <ReadingCard {...props} baseStyle={baseStyle} />
  if (cardType === 'club_invite') return <ClubInviteCard {...props} baseStyle={baseStyle} />

  // Default "quote" card
  return (
    <View style={baseStyle}>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 18,
            lineHeight: 26,
            color: template.bodyColor,
          }}
          numberOfLines={10}
        >
          {props.passage ? `“${props.passage}”` : 'Your passage will appear here.'}
        </Text>
      </View>
      <CardFooter template={template} bookTitle={bookTitle} author={author} deepLink={deepLink} />
    </View>
  )
}

function FinishedCard({
  template,
  bookTitle,
  author,
  coverUrl,
  rating,
  daysToRead,
  highlightCount,
  deepLink,
  baseStyle,
}: CardPreviewProps & { baseStyle: object }) {
  return (
    <View style={baseStyle}>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 16,
            color: template.metaColor,
            marginBottom: 18,
          }}
        >
          I just finished
        </Text>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ width: 140, height: 210, borderRadius: 6, marginBottom: 16 }}
          />
        ) : (
          <View
            style={{
              width: 140,
              height: 210,
              borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <BookOpen color={template.bodyColor} size={28} />
          </View>
        )}
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: template.bodyColor,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {bookTitle}
        </Text>
        {author ? (
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 13, color: template.metaColor, marginTop: 4 }}
          >
            {author}
          </Text>
        ) : null}
        {rating > 0 ? (
          <View className="flex-row" style={{ marginTop: 10, gap: 2 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                color={template.bodyColor}
                size={14}
                weight={n <= rating ? 'fill' : 'regular'}
              />
            ))}
          </View>
        ) : null}
        {daysToRead != null || highlightCount != null ? (
          <View className="flex-row items-center" style={{ marginTop: 10, gap: 12 }}>
            {daysToRead != null ? (
              <Text
                style={{ fontFamily: Fonts.mono, fontSize: 11, color: template.metaColor }}
              >
                {daysToRead} day{daysToRead === 1 ? '' : 's'}
              </Text>
            ) : null}
            {highlightCount != null ? (
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Highlighter color={template.metaColor} size={11} />
                <Text
                  style={{ fontFamily: Fonts.mono, fontSize: 11, color: template.metaColor }}
                >
                  {highlightCount}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <CardFooter template={template} bookTitle="" author="" deepLink={deepLink} />
    </View>
  )
}

function ReadingCard({
  template,
  bookTitle,
  author,
  coverUrl,
  progress,
  deepLink,
  baseStyle,
}: CardPreviewProps & { baseStyle: object }) {
  const pct = typeof progress === 'number' ? Math.round(progress * 100) : null
  return (
    <View style={baseStyle}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 16,
            color: template.metaColor,
            marginBottom: 16,
          }}
        >
          I'm reading
        </Text>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ width: 130, height: 195, borderRadius: 6, marginBottom: 16 }}
          />
        ) : (
          <View
            style={{
              width: 130,
              height: 195,
              borderRadius: 6,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <BookOpen color={template.bodyColor} size={28} />
          </View>
        )}
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 18,
            color: template.bodyColor,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {bookTitle}
        </Text>
        {author ? (
          <Text
            style={{ fontFamily: Fonts.ui, fontSize: 13, color: template.metaColor, marginTop: 4 }}
          >
            {author}
          </Text>
        ) : null}
        {pct !== null ? (
          <View style={{ marginTop: 18, width: '70%' }}>
            <View
              style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.18)',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${pct}%`,
                  height: 4,
                  backgroundColor: template.wordmarkColor,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: Fonts.mono,
                fontSize: 11,
                color: template.metaColor,
                textAlign: 'center',
                marginTop: 6,
              }}
            >
              {pct}% complete
            </Text>
          </View>
        ) : null}
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 12,
            color: template.metaColor,
            marginTop: 16,
          }}
        >
          Join me on Foxing
        </Text>
      </View>
      <CardFooter template={template} bookTitle="" author="" deepLink={deepLink} />
    </View>
  )
}

function ClubInviteCard({
  template,
  bookTitle,
  coverUrl,
  clubName,
  memberCount,
  deepLink,
  baseStyle,
}: CardPreviewProps & { baseStyle: object }) {
  return (
    <View style={baseStyle}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: Fonts.bodyItalic,
            fontSize: 14,
            color: template.metaColor,
            marginBottom: 10,
            textAlign: 'center',
          }}
        >
          You're invited to read with us
        </Text>
        <Text
          style={{
            fontFamily: Fonts.displayBold,
            fontSize: 22,
            color: template.bodyColor,
            marginBottom: 18,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          {clubName ?? 'A Foxing Club'}
        </Text>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ width: 110, height: 165, borderRadius: 6, marginBottom: 14 }}
          />
        ) : (
          <View
            style={{
              width: 110,
              height: 165,
              borderRadius: 6,
              backgroundColor: 'rgba(0,0,0,0.05)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}
          >
            <UsersThree color={template.bodyColor} size={26} />
          </View>
        )}
        <Text
          style={{
            fontFamily: Fonts.uiMedium,
            fontSize: 13,
            color: template.bodyColor,
            textAlign: 'center',
          }}
          numberOfLines={2}
        >
          Reading {bookTitle}
        </Text>
        {memberCount != null ? (
          <Text
            style={{ fontFamily: Fonts.mono, fontSize: 11, color: template.metaColor, marginTop: 4 }}
          >
            {memberCount} member{memberCount === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>
      <CardFooter template={template} bookTitle="" author="" deepLink={deepLink} />
    </View>
  )
}

function CardFooter({
  template,
  bookTitle,
  author,
  deepLink,
}: {
  template: TemplateDef
  bookTitle: string
  author: string
  deepLink: string
}) {
  return (
    <View>
      {bookTitle ? (
        <Text
          style={{ fontFamily: Fonts.uiMedium, fontSize: 12, color: template.metaColor }}
          numberOfLines={1}
        >
          {bookTitle}
        </Text>
      ) : null}
      {author ? (
        <Text
          style={{ fontFamily: Fonts.ui, fontSize: 11, color: template.metaColor, marginTop: 2 }}
          numberOfLines={1}
        >
          {author}
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: Fonts.mono,
          fontSize: 10,
          color: template.metaColor,
          marginTop: 6,
        }}
        numberOfLines={1}
      >
        {deepLink}
      </Text>
      <Text
        style={{
          fontFamily: Fonts.display,
          fontSize: 11,
          color: template.wordmarkColor,
          position: 'absolute',
          right: 0,
          bottom: 0,
        }}
      >
        Foxing
      </Text>
    </View>
  )
}
