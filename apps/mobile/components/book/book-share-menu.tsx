import { Share } from "react-native";
import { useRouter } from "expo-router";
import { ImageSquare, Link as LinkIcon, Megaphone } from "phosphor-react-native";
import type * as W from "@foxing/types";
import { BottomSheetMenu } from "@/components/book/bottom-sheet-menu";

export function BookShareMenu({
  book,
  visible,
  onClose,
}: {
  book: W.BookPage["book"];
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <BottomSheetMenu
      visible={visible}
      title="Share"
      onClose={onClose}
      items={[
        {
          id: "quote",
          label: "Create Quote Card",
          Icon: ImageSquare,
          onPress: () => {
            router.push(
              `/quote-card?bookId=${book.id}&bookTitle=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}` as never,
            );
          },
        },
        {
          id: "reading",
          label: "I'm Reading This",
          Icon: Megaphone,
          onPress: () =>
            void Share.share({
              message: `I'm reading "${book.title}" by ${book.author} on Foxing. https://foxing.app/books/${book.slug}`,
            }).catch(() => {
              /* user canceled */
            }),
        },
        {
          id: "link",
          label: "Share link",
          Icon: LinkIcon,
          onPress: () =>
            void Share.share({ message: `https://foxing.app/books/${book.slug}` }).catch(() => {
              /* user canceled */
            }),
        },
      ]}
    />
  );
}
