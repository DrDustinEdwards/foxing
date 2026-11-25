import type * as W from "@foxing/types";
import { ChatCircleDots } from "phosphor-react-native";
import { Image, Pressable, Text, View } from "react-native";
import { Byline, SpoilerGate } from "@/components/ui/spoiler-gate";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { relativeTime } from "@/lib/relative-time";

export function CommentCard({
  comment,
  replies,
  revealed,
  onToggleReveal,
  onReply,
}: {
  comment: W.ResolvedComment;
  replies: W.ResolvedComment[];
  revealed: boolean;
  onToggleReveal: () => void;
  onReply: () => void;
}) {
  const colors = useColors();
  const name = comment.author.displayName ?? comment.author.username ?? "Reader";
  const initial = (name || "?")[0]?.toUpperCase() ?? "?";
  // Collapsed when the author flagged a spoiler or it sits ahead of where the viewer is.
  const gated = comment.gate.spoiler || comment.gate.ahead;
  const hidden = gated && !revealed;

  return (
    <View className="flex-row p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark">
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: colors.brandSubtle,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 10,
        }}
      >
        {comment.author.avatarUrl ? (
          <Image
            source={{ uri: comment.author.avatarUrl }}
            style={{ width: "100%", height: "100%" }}
          />
        ) : (
          <Text style={{ fontFamily: Fonts.display, fontSize: 15, color: colors.brandSubtleText }}>
            {initial}
          </Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Byline name={name} meta={relativeTime(comment.createdAt)} />

        <SpoilerGate
          hidden={hidden}
          gated={gated}
          body={comment.body}
          hiddenLabel={
            comment.gate.spoiler
              ? "Spoiler, tap to reveal"
              : "Further on than you are, tap to reveal"
          }
          shownLabel="Shown, tap to hide"
          onToggle={onToggleReveal}
          accessibilityRole="button"
        />

        <View className="flex-row items-center mt-3">
          <Pressable
            onPress={onReply}
            accessibilityRole="button"
            className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
            style={{ borderColor: colors.borderSubtle }}
          >
            <ChatCircleDots color={colors.textTertiary} size={12} />
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary }}>
              Reply
            </Text>
          </Pressable>
        </View>

        {replies.length > 0 ? (
          <View
            style={{
              marginTop: 10,
              paddingLeft: 12,
              borderLeftWidth: 2,
              borderLeftColor: colors.borderSubtle,
            }}
          >
            {replies.map((r) => (
              <View key={r.id} style={{ marginBottom: 8 }}>
                <View className="flex-row items-center" style={{ marginBottom: 2 }}>
                  <Text
                    style={{
                      fontFamily: Fonts.uiMedium,
                      fontSize: 12,
                      color: colors.textPrimary,
                      marginRight: 6,
                    }}
                    numberOfLines={1}
                  >
                    {r.author.displayName ?? r.author.username ?? "Reader"}
                  </Text>
                  <Text style={{ fontFamily: Fonts.ui, fontSize: 10, color: colors.textTertiary }}>
                    {relativeTime(r.createdAt)}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: Fonts.body,
                    fontSize: 13,
                    color: colors.textPrimary,
                    lineHeight: 19,
                  }}
                >
                  {r.body}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
