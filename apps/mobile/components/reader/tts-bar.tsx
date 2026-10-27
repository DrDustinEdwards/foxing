import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X as XIcon,
  Moon,
} from 'phosphor-react-native'
import * as Speech from 'expo-speech'
import { useColors } from '@/constants/colors'
import { Fonts } from '@/constants/fonts'

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0] as const
const SLEEP_TIMERS = [15, 30, 45, 60] as const

interface TtsBarProps {
  visible: boolean
  // Plain text of the chapter being read. Empty disables play.
  chapterText: string
  // Notify the host whenever the current sentence changes so it can ask
  // the WebView to highlight it.
  onCurrentSentence?: (index: number | null, text: string | null) => void
  onClose: () => void
}

export function TtsBar({ visible, chapterText, onCurrentSentence, onClose }: TtsBarProps) {
  const colors = useColors()
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1)
  const [index, setIndex] = useState(0)
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null)
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null)

  const sleepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sentence split, rough but workable. Splits on . ! ? followed by space or end.
  const sentences = useMemo(() => {
    const parts = (chapterText ?? '')
      .replace(/\s+/g, ' ')
      .match(/[^.!?]+[.!?]+["')\]]*\s*/g) ?? []
    return parts.map((s) => s.trim()).filter((s) => s.length > 0)
  }, [chapterText])

  const stop = useCallback(() => {
    try { Speech.stop() } catch {}
    setPlaying(false)
  }, [])

  // Speak a specific sentence. onDone advances to the next; onStopped is
  // expected (we call .stop on every transition) and is a no-op.
  const speakAt = useCallback(
    (i: number) => {
      if (i < 0 || i >= sentences.length) {
        setPlaying(false)
        return
      }
      const text = sentences[i]
      onCurrentSentence?.(i + 1, text)
      setIndex(i)
      try {
        Speech.speak(text, {
          rate: speed,
          onDone: () => {
            // Auto-advance. Skip if user paused / stopped in the meantime.
            // We can't read state inside an old callback, rely on the
            // module's "stopped" callback to short-circuit instead.
            const next = i + 1
            if (next >= sentences.length) {
              setPlaying(false)
              onCurrentSentence?.(null, null)
              return
            }
            speakAt(next)
          },
          onStopped: () => { /* expected on transitions */ },
        })
      } catch (e) {
        console.warn('[tts] speak failed:', e instanceof Error ? e.message : e)
        setPlaying(false)
      }
    },
    [onCurrentSentence, sentences, speed],
  )

  // Clean up on unmount / visibility close.
  useEffect(() => {
    if (!visible) {
      stop()
      setIndex(0)
      onCurrentSentence?.(null, null)
    }
  }, [visible, stop, onCurrentSentence])

  // Stop active speech if the user changes speed mid-sentence and resume
  // from the same sentence so the rate change actually takes effect.
  useEffect(() => {
    if (!playing) return
    try { Speech.stop() } catch {}
    speakAt(index)
    // intentionally only on speed change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed])

  const togglePlay = useCallback(() => {
    if (playing) {
      stop()
      return
    }
    setPlaying(true)
    speakAt(index)
  }, [index, playing, speakAt, stop])

  const next = useCallback(() => {
    stop()
    const i = Math.min(sentences.length - 1, index + 1)
    setIndex(i)
    if (playing) {
      setPlaying(true)
      speakAt(i)
    }
  }, [index, playing, sentences.length, speakAt, stop])

  const prev = useCallback(() => {
    stop()
    const i = Math.max(0, index - 1)
    setIndex(i)
    if (playing) {
      setPlaying(true)
      speakAt(i)
    }
  }, [index, playing, speakAt, stop])

  // Sleep timer, stops playback after N minutes.
  const startSleepTimer = useCallback(
    (minutes: number) => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
      setSleepMinutes(minutes)
      setSleepRemaining(minutes * 60)
      sleepTimerRef.current = setInterval(() => {
        setSleepRemaining((s) => {
          if (s === null) return null
          const next = s - 10
          if (next <= 0) {
            stop()
            if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
            return 0
          }
          return next
        })
      }, 10_000)
    },
    [stop],
  )

  const cancelSleepTimer = useCallback(() => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
    sleepTimerRef.current = null
    setSleepMinutes(null)
    setSleepRemaining(null)
  }, [])

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current)
    }
  }, [])

  if (!visible) return null

  const currentText = sentences[index] ?? ''

  return (
    <SafeAreaView
      edges={['bottom']}
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0"
    >
      <View
        className="mx-3 mb-2 rounded-2xl border bg-bg-elevated-light dark:bg-bg-elevated-dark border-border-subtle-light dark:border-border-subtle-dark"
        style={{
          padding: 12,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        }}
      >
        <View className="flex-row items-center" style={{ marginBottom: 8 }}>
          <Text
            style={{
              flex: 1,
              fontFamily: Fonts.uiMedium,
              fontSize: 11,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Listen
          </Text>
          {sleepRemaining !== null ? (
            <Pressable onPress={cancelSleepTimer} hitSlop={6} style={{ marginRight: 12 }}>
              <Text style={{ fontFamily: Fonts.mono, fontSize: 11, color: colors.brandText }}>
                {Math.ceil(sleepRemaining / 60)}m
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={8}>
            <XIcon color={colors.textPrimary} size={16} />
          </Pressable>
        </View>

        <>
          <Text
              style={{
                fontFamily: Fonts.body,
                fontSize: 13,
                color: colors.textPrimary,
                lineHeight: 19,
                marginBottom: 10,
              }}
              numberOfLines={2}
            >
              {currentText || (sentences.length === 0 ? 'Nothing to read on this page.' : '…')}
            </Text>

            <View className="flex-row items-center justify-center" style={{ gap: 18 }}>
              <Pressable onPress={prev} hitSlop={6}>
                <SkipBack color={colors.textPrimary} size={20} weight="regular" />
              </Pressable>
              <Pressable
                onPress={togglePlay}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.brandUi,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {playing ? (
                  <Pause color={colors.textOnBrand} size={22} weight="fill" />
                ) : (
                  <Play color={colors.textOnBrand} size={22} weight="fill" />
                )}
              </Pressable>
              <Pressable onPress={next} hitSlop={6}>
                <SkipForward color={colors.textPrimary} size={20} weight="regular" />
              </Pressable>
            </View>

            <View
              className="flex-row items-center justify-between"
              style={{ marginTop: 10 }}
            >
              <View className="flex-row" style={{ gap: 4 }}>
                {SPEED_OPTIONS.map((s) => {
                  const active = s === speed
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setSpeed(s)}
                      className="px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: active ? colors.bgSelected : 'transparent',
                        borderWidth: 1,
                        borderColor: active ? colors.borderBrand : colors.borderSubtle,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Fonts.mono,
                          fontSize: 10,
                          color: active ? colors.brandText : colors.textSecondary,
                        }}
                      >
                        {s}x
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Moon color={colors.textTertiary} size={12} />
                {SLEEP_TIMERS.map((m) => {
                  const active = sleepMinutes === m
                  return (
                    <Pressable
                      key={m}
                      onPress={() => (active ? cancelSleepTimer() : startSleepTimer(m))}
                      className="px-2 py-1 rounded-full"
                      style={{
                        backgroundColor: active ? colors.bgSelected : 'transparent',
                        borderWidth: 1,
                        borderColor: active ? colors.borderBrand : colors.borderSubtle,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: Fonts.mono,
                          fontSize: 10,
                          color: active ? colors.brandText : colors.textSecondary,
                        }}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
        </>
      </View>
    </SafeAreaView>
  )
}
