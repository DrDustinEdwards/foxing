import { useBookAnnotations, useBookPage, useMyBook, useSetBookStatus } from "@foxing/client";
import type * as W from "@foxing/types";
import { useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ShareNetwork,
  CaretRight,
  CaretDown,
  BookmarkSimple,
  CheckCircle,
  Lightbulb,
  Student,
} from "phosphor-react-native";
import { useColors } from "@/constants/colors";
import { Fonts } from "@/constants/fonts";
import { authClient, queueWrite } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { FinishReviewSheet } from "@/components/book/finish-review-sheet";
import { PrimaryCta } from "@/components/book/primary-cta";
import { BottomSheetMenu } from "@/components/book/bottom-sheet-menu";
import { PauseNoteModal } from "@/components/book/pause-note-modal";
import {
  ExpandableText,
  SecondaryButton,
  SectionHeading,
} from "@/components/book/book-detail-parts";
import { BookHero } from "@/components/book/book-hero";
import { BookIdentity } from "@/components/book/book-identity";
import { BookCommunity } from "@/components/book/book-community";
import { BookSocialSections } from "@/components/book/book-social-sections";
import { BookClubs } from "@/components/book/book-clubs";
import { BookRow } from "@/components/book/book-row";
import { BookShareMenu } from "@/components/book/book-share-menu";
import { CompanionSheet } from "@/components/reader/companion-sheet";

export default function BookDetail() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = authClient.useSession();
  const signedIn = !!session.data;
  const pageQuery = useBookPage(id ?? "");
  const page = pageQuery.data;
  const book = page?.book ?? null;
  const myBook = useMyBook(book?.id ?? "", undefined, signedIn && !!book);
  const userBook = myBook.data ?? null;
  const annotations = useBookAnnotations(book?.id ?? "");
  const setBookStatus = useSetBookStatus();

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseNote, setPauseNote] = useState("");
  // Celebration flow runs after the sheet closes so two routes do not stack.
  const [finishReviewOpen, setFinishReviewOpen] = useState(false);
  const finishCelebrationRef = useRef<(() => void) | null>(null);
  const [companion, setCompanion] = useState<"book_insight" | "deep_dive" | null>(null);

  const [showDescription, setShowDescription] = useState(false);

  function setStatus(status: W.ShelfStatus) {
    setStatusMenuOpen(false);
    if (!book) return;
    if (!signedIn) {
      router.push("/(auth)/login" as never);
      return;
    }
    const wasFinished = userBook?.status === "finished";
    setBookStatus.fire({ bookId: book.id, status, book });
    if (status !== "finished" || wasFinished) return;
    haptic.success();
    const daysToRead = userBook?.startedAt
      ? Math.max(1, Math.round((Date.now() - userBook.startedAt) / 86_400_000))
      : null;
    const highlightCount = (annotations.data?.mine ?? []).filter(
      (m) => m.type === "highlight",
    ).length;
    const next = page?.nextInSeries ?? null;
    finishCelebrationRef.current = () => {
      router.push({
        pathname: "/quote-card",
        params: {
          type: "finished",
          bookId: book.id,
          bookTitle: book.title,
          author: book.author,
          coverUrl: book.coverUrl ?? "",
          daysToRead: daysToRead != null ? String(daysToRead) : "",
          highlightCount: String(highlightCount),
        },
      } as never);
      if (!next) return;
      setTimeout(() => {
        Alert.alert(
          `Next in ${book.seriesName ?? "the series"}`,
          `${next.title} is up next. Add it to your library?`,
          [
            { text: "Maybe later", style: "cancel" },
            {
              text: "Add to Want to Read",
              onPress: () => setBookStatus.fire({ bookId: next.id, status: "want", book: next }),
            },
            { text: "Open", onPress: () => router.push(`/book/${next.slug}` as never) },
          ],
        );
      }, 600);
    };
    setFinishReviewOpen(true);
  }

  if (pageQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-base-light dark:bg-bg-base-dark">
        <ActivityIndicator color={colors.brandUi} />
      </SafeAreaView>
    );
  }
  if (!book || !page) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center px-8 bg-bg-base-light dark:bg-bg-base-dark">
        <Text
          style={{
            fontFamily: Fonts.ui,
            fontSize: 14,
            color: colors.textTertiary,
            textAlign: "center",
          }}
        >
          {pageQuery.isError && (pageQuery.error as { status?: number }).status !== 404
            ? "We couldn't load that book. Check your connection and try again."
            : "We couldn't find that book."}
        </Text>
        <Pressable onPress={() => router.back()} className="mt-3">
          <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText }}>Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const description = page.ai.description ?? book.description;
  return (
    <View className="flex-1 bg-bg-base-light dark:bg-bg-base-dark">
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <BookHero book={book} onBack={() => router.back()} onShare={() => setShareMenuOpen(true)} />

        <View style={{ marginTop: 48, paddingHorizontal: 20 }}>
          <BookIdentity book={book} />

          {/* Primary CTA */}
          <PrimaryCta
            userBook={userBook}
            onAddPress={() => setStatusMenuOpen(true)}
            onContinue={() => {
              if (!book.readable) return;
              if (userBook?.status !== "reading") setStatus("reading");
              router.push(`/reader/${book.id}` as never);
            }}
            onReread={() => {
              setStatus("reading");
              router.push(`/reader/${book.id}` as never);
            }}
          />

          {/* Secondary row */}
          <View className="flex-row items-center justify-around mt-3 mb-2">
            <SecondaryButton
              Icon={BookmarkSimple}
              label="Want"
              onPress={() => setStatus("want")}
              active={userBook?.status === "want"}
            />
            <SecondaryButton
              Icon={CheckCircle}
              label="Finished"
              onPress={() => setStatus("finished")}
              active={userBook?.status === "finished"}
            />
            <SecondaryButton
              Icon={ShareNetwork}
              label="Share"
              onPress={() => setShareMenuOpen(true)}
            />
          </View>
        </View>

        <BookCommunity book={book} page={page} />

        {/* Where to Read, high up so read/library/buy options come before the AI cards. */}
        <SectionHeading>Where to read</SectionHeading>
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {book.readable ? (
            <Pressable
              onPress={() => router.push(`/reader/${book.id}` as never)}
              accessibilityRole="button"
              accessibilityLabel="Read this book in Foxing"
              className="px-4 py-3 rounded-xl items-center"
              style={{ backgroundColor: colors.brandUi }}
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textOnBrand, fontSize: 14 }}>
                Read free in Foxing
              </Text>
            </Pressable>
          ) : null}
          {page.buys.map((b) => (
            <Pressable
              key={b.retailer}
              onPress={() => void Linking.openURL(b.url)}
              accessibilityRole="link"
              accessibilityLabel={b.sponsored ? `${b.label} (affiliate link)` : b.label}
              className="px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-interactive-light dark:border-border-interactive-dark items-center"
            >
              <Text style={{ fontFamily: Fonts.uiMedium, color: colors.textPrimary, fontSize: 14 }}>
                {b.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* About this book, collapsed by default. Lazy-loads the AI description on first expand. */}
        <View style={{ paddingHorizontal: 20, marginTop: 22 }}>
          <Pressable
            onPress={() => setShowDescription((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showDescription ? "Hide about this book" : "Show about this book"}
            accessibilityState={{ expanded: showDescription }}
            className="flex-row items-center justify-between px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
          >
            <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
              About this book
            </Text>
            {showDescription ? (
              <CaretDown color={colors.textTertiary} size={14} />
            ) : (
              <CaretRight color={colors.textTertiary} size={14} />
            )}
          </Pressable>
          {showDescription ? (
            <View style={{ marginTop: 8 }}>
              {description ? (
                <ExpandableText text={description} />
              ) : (
                <Text style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textTertiary }}>
                  No description yet.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        {page.ai.authorBio ? (
          <>
            <SectionHeading>About {book.author}</SectionHeading>
            <View style={{ paddingHorizontal: 20 }}>
              <ExpandableText text={page.ai.authorBio} />
            </View>
          </>
        ) : null}

        {page.ai.readingOrder ? (
          <>
            <SectionHeading>Reading order</SectionHeading>
            <View style={{ paddingHorizontal: 20 }}>
              <ExpandableText text={page.ai.readingOrder} />
            </View>
          </>
        ) : null}

        {/* Plus companion answers about the whole book. */}
        <SectionHeading>Ask the companion</SectionHeading>
        <View className="flex-row" style={{ paddingHorizontal: 20, gap: 8 }}>
          {(
            [
              { action: "book_insight", label: "An insight", Icon: Lightbulb },
              { action: "deep_dive", label: "Go deeper", Icon: Student },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.action}
              onPress={() =>
                signedIn ? setCompanion(t.action) : router.push("/(auth)/login" as never)
              }
              accessibilityRole="button"
              className="flex-1 flex-row items-center justify-center px-4 py-3 rounded-xl border bg-bg-surface-light dark:bg-bg-surface-dark border-border-subtle-light dark:border-border-subtle-dark"
              style={{ gap: 8 }}
            >
              <t.Icon color={colors.brandUi} size={18} />
              <Text style={{ fontFamily: Fonts.uiMedium, fontSize: 14, color: colors.textPrimary }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {page.awards.length > 0 ? (
          <>
            <SectionHeading>Awards</SectionHeading>
            <View style={{ paddingHorizontal: 20, gap: 4 }}>
              {page.awards.map((a) => (
                <Text
                  key={`${a.awardSlug}:${a.year}:${a.distinction}`}
                  style={{ fontFamily: Fonts.ui, fontSize: 13, color: colors.textSecondary }}
                >
                  {a.awardName}
                  {a.year ? ` ${a.year}` : ""}
                  {a.distinction && a.distinction !== "winner" ? `, ${a.distinction}` : ""}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        <BookSocialSections page={page} />

        {/* Similar books. */}
        {page.ai.similarBooks ? (
          <>
            <SectionHeading>If you like this</SectionHeading>
            <View style={{ paddingHorizontal: 20 }}>
              <ExpandableText text={page.ai.similarBooks} />
            </View>
          </>
        ) : null}

        <BookRow
          title="Readers also liked"
          books={page.related}
          onOpen={(slug) => router.push(`/book/${slug}` as never)}
        />
        {page.nextInSeries ? (
          <BookRow
            title={`Next in ${book.seriesName ?? "the series"}`}
            books={[page.nextInSeries]}
            onOpen={(slug) => router.push(`/book/${slug}` as never)}
          />
        ) : null}

        {/* Author section */}
        {page.moreByAuthor.length > 0 ? (
          <>
            <BookRow
              title={`More by ${book.author}`}
              books={page.moreByAuthor}
              onOpen={(slug) => router.push(`/book/${slug}` as never)}
            />
            <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
              <Pressable
                onPress={() =>
                  book.authorSlug && router.push(`/author/${book.authorSlug}` as never)
                }
                className="flex-row items-center"
              >
                <Text style={{ fontFamily: Fonts.uiMedium, color: colors.brandText, fontSize: 13 }}>
                  View author page
                </Text>
                <CaretRight color={colors.brandText} size={14} />
              </Pressable>
            </View>
          </>
        ) : null}

        {page.clubs.length > 0 ? <BookClubs clubs={page.clubs} /> : null}
      </ScrollView>

      {/* Add to Library status menu */}
      <BottomSheetMenu
        visible={statusMenuOpen}
        title="Add to library"
        onClose={() => setStatusMenuOpen(false)}
        items={[
          { id: "want", label: "Want to Read", onPress: () => setStatus("want") },
          { id: "reading", label: "Currently Reading", onPress: () => setStatus("reading") },
          ...(book.readable
            ? [
                {
                  id: "now",
                  label: "Start Reading Now",
                  onPress: () => {
                    setStatus("reading");
                    router.push(`/reader/${book.id}` as never);
                  },
                },
              ]
            : []),
          { id: "finished", label: "Finished", onPress: () => setStatus("finished") },
          {
            id: "pause",
            label: "Pause Reading",
            onPress: () => {
              setPauseNote("");
              setPauseModalOpen(true);
            },
          },
        ]}
      />

      <FinishReviewSheet
        visible={finishReviewOpen}
        bookId={book.id}
        bookTitle={book.title}
        onClose={() => {
          setFinishReviewOpen(false);
          const run = finishCelebrationRef.current;
          finishCelebrationRef.current = null;
          if (run) run();
        }}
      />

      <PauseNoteModal
        visible={pauseModalOpen}
        note={pauseNote}
        onChangeNote={setPauseNote}
        onCancel={() => setPauseModalOpen(false)}
        onConfirm={() => {
          setPauseModalOpen(false);
          setStatus("paused");
          const note = pauseNote.trim();
          if (note)
            void queueWrite({
              resource: "user_book",
              verb: "update",
              payload: { bookId: book.id, pausedNote: note },
            });
        }}
      />

      <BookShareMenu book={book} visible={shareMenuOpen} onClose={() => setShareMenuOpen(false)} />

      <CompanionSheet
        visible={companion !== null}
        title={companion === "deep_dive" ? "Go deeper" : "An insight"}
        request={companion ? { action: companion, bookId: book.id } : null}
        onClose={() => setCompanion(null)}
      />
    </View>
  );
}
