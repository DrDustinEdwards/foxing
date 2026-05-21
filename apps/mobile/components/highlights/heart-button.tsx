import { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Heart } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

interface Props {
  highlightId: string
  initialCount?: number
  ownerId?: string | null
}

export function HeartButton({ highlightId, initialCount, ownerId }: Props) {
  const colors = useColors()
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(initialCount ?? 0)
  const [userId, setUserId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      setUserId(user?.id ?? null)
      if (!user) return
      const { data } = await supabase
        .from('highlight_likes')
        .select('user_id')
        .eq('highlight_id', highlightId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!cancelled && data) setLiked(true)
    })()
    return () => {
      cancelled = true
    }
  }, [highlightId])

  const toggle = useCallback(async () => {
    if (!userId || busy) return
    if (ownerId && ownerId === userId) return
    setBusy(true)
    const next = !liked
    setLiked(next)
    setCount((c) => Math.max(0, c + (next ? 1 : -1)))
    if (next) {
      const { error } = await supabase
        .from('highlight_likes')
        .insert({ highlight_id: highlightId, user_id: userId })
      if (error) {
        setLiked(false)
        setCount((c) => Math.max(0, c - 1))
      }
    } else {
      const { error } = await supabase
        .from('highlight_likes')
        .delete()
        .eq('highlight_id', highlightId)
        .eq('user_id', userId)
      if (error) {
        setLiked(true)
        setCount((c) => c + 1)
      }
    }
    setBusy(false)
  }, [busy, highlightId, liked, ownerId, userId])

  const isOwn = Boolean(ownerId && userId && ownerId === userId)
  const color = liked ? colors.brandUi : colors.textTertiary
  return (
    <Pressable
      onPress={isOwn ? undefined : toggle}
      hitSlop={10}
      disabled={isOwn || !userId}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 4,
        opacity: isOwn ? 0.7 : 1,
      }}
    >
      <Heart color={color} size={16} weight={liked ? 'fill' : 'regular'} />
      {count > 0 ? (
        <Text
          style={{
            fontFamily: Fonts.mono,
            fontSize: 11,
            color,
          }}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  )
}
