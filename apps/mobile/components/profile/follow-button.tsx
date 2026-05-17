import { useCallback, useEffect, useState } from 'react'
import { Pressable, Text, ActivityIndicator, View } from 'react-native'
import { Plus, Check } from 'phosphor-react-native'
import { supabase } from '@/lib/supabase'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'
import { createNotification } from '@/lib/notifications'

interface FollowButtonProps {
  // The user being followed. The current viewer is read from auth.
  targetUserId: string
  // Optional callback fired whenever the relationship state changes
  // successfully, host can refresh follower counts.
  onChange?: (isFollowing: boolean) => void
  size?: 'sm' | 'md'
}

// Encapsulates the lookup + toggle for a single (viewer → target) edge in the
// follows table. Optimistic: flip state immediately, revert on error. Hidden
// when the viewer is unauthenticated or when target === viewer.
export function FollowButton({ targetUserId, onChange, size = 'md' }: FollowButtonProps) {
  const colors = useColors()
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      setViewerId(user?.id ?? null)
      if (!user || user.id === targetUserId) {
        setIsFollowing(false)
        return
      }
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle()
      if (!mounted) return
      if (error) console.warn('[follow-button] read failed:', error.message)
      setIsFollowing(!!data)
    })()
    return () => {
      mounted = false
    }
  }, [targetUserId])

  const toggle = useCallback(async () => {
    if (!viewerId || viewerId === targetUserId) return
    if (isFollowing === null || busy) return
    const next = !isFollowing
    setIsFollowing(next)
    setBusy(true)
    try {
      if (next) {
        const { error } = await supabase
          .from('follows')
          .insert({ follower_id: viewerId, following_id: targetUserId })
        if (error) throw error
        // Best-effort notification to the followee. Look up the follower's
        // name for the body; fall back to a generic message on miss.
        ;(async () => {
          const { data: me } = await supabase
            .from('profiles')
            .select('display_name, username')
            .eq('id', viewerId)
            .maybeSingle()
          const me2 = me as { display_name: string | null; username: string | null } | null
          const name = me2?.display_name ?? me2?.username ?? 'Someone'
          await createNotification(
            targetUserId,
            'new_follower',
            'New follower',
            `${name} is now following you.`,
            { follower_id: viewerId },
          )
        })().catch(() => {})
      } else {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', viewerId)
          .eq('following_id', targetUserId)
        if (error) throw error
      }
      onChange?.(next)
    } catch (e) {
      console.warn('[follow-button] toggle failed:', e instanceof Error ? e.message : e)
      // Revert optimistic flip.
      setIsFollowing(!next)
    } finally {
      setBusy(false)
    }
  }, [busy, isFollowing, onChange, targetUserId, viewerId])

  // Hide entirely for self or while we don't know who the viewer is.
  if (!viewerId || viewerId === targetUserId) return null
  if (isFollowing === null) {
    return (
      <View
        style={{
          paddingHorizontal: size === 'sm' ? 12 : 16,
          paddingVertical: size === 'sm' ? 6 : 8,
          borderRadius: 999,
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          minWidth: size === 'sm' ? 80 : 100,
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={colors.brandUi} size="small" />
      </View>
    )
  }

  const labelSize = size === 'sm' ? 12 : 13
  const padX = size === 'sm' ? 12 : 16
  const padY = size === 'sm' ? 6 : 8
  const iconSize = size === 'sm' ? 12 : 14

  const following = isFollowing
  const bg = following ? colors.bgSurface : colors.brandUi
  const fg = following ? colors.textPrimary : colors.textOnBrand
  const borderColor = following ? colors.borderInteractive : colors.brandUi

  return (
    <Pressable
      onPress={toggle}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={following ? 'Unfollow' : 'Follow'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: padX,
        paddingVertical: padY,
        borderRadius: 999,
        backgroundColor: bg,
        borderColor,
        borderWidth: 1,
        opacity: busy ? 0.7 : 1,
      }}
    >
      {following ? (
        <Check color={fg} size={iconSize} weight="bold" />
      ) : (
        <Plus color={fg} size={iconSize} weight="bold" />
      )}
      <Text style={{ fontFamily: Fonts.uiMedium, fontSize: labelSize, color: fg }}>
        {following ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  )
}
