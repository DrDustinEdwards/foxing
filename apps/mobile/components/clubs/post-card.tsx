import type * as W from "@foxing/types";
import { Avatar } from "@/components/ui/avatar";
import { useColors } from "@/constants/colors";
import { Pressable, Text, View } from "react-native";
import { Fonts } from "@/constants/fonts";
import { relativeTime } from "@/lib/relative-time";
import { Byline, SpoilerGate } from "@/components/ui/spoiler-gate";
import { ChatCircleDots } from "phosphor-react-native";

export function PostCard({
  post,
  nested,
  revealed,
  canReply,
  onToggleReveal,
  onReply,
  onOpenAuthor,
  onLongPress,
}: {
  post: W.ClubPostItem;
  nested?: boolean;
  revealed: boolean;
  canReply: boolean;
  onToggleReveal: () => void;
  onReply?: () => void;
  onOpenAuthor: (username: string) => void;
  onLongPress?: () => void;
}) {
  const colors = useColors();
  const name = post.author?.displayName ?? post.author?.username ?? "Reader";
  const hidden = post.hasSpoiler && !revealed;

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={400}
      className="flex-row p-3 mb-2 rounded-2xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
      style={{ opacity: nested ? 0.98 : 1 }}
    >
      <Pressable onPress={() => post.author && onOpenAuthor(post.author.username)} hitSlop={4}>
        <Avatar profile={post.author} size={nested ? 32 : 36} style={{ marginRight: 10 }} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Byline
          name={name}
          meta={`${relativeTime(post.createdAt)}${post.isEdited ? " · edited" : ""}`}
          onPressName={() => post.author && onOpenAuthor(post.author.username)}
        />

        <SpoilerGate
          hidden={hidden}
          gated={post.hasSpoiler}
          body={post.content}
          hiddenLabel="Spoiler, tap to reveal"
          shownLabel="Spoiler shown, tap to hide"
          onToggle={onToggleReveal}
        />

        <View className="flex-row items-center mt-3 gap-1 flex-wrap">
          {onReply && canReply && !nested ? (
            <Pressable
              onPress={onReply}
              className="flex-row items-center gap-1 px-2 py-1 rounded-full border"
              style={{ borderColor: colors.borderSubtle }}
            >
              <ChatCircleDots color={colors.textTertiary} size={12} />
              <Text
                style={{ fontFamily: Fonts.uiMedium, fontSize: 11, color: colors.textTertiary }}
              >
                Reply
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
