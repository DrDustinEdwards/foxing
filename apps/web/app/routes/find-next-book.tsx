// Find next book (auth-gated, noindex): a tiered recommendation grid. Reads run
// in-process via core (loadRecommendations); the Want-to-read write per book goes to
// /api/v1 through BookStatusControl (visible pending + role=alert error). Free readers
// get data-driven picks with a subtle upgrade affordance; Plus readers get AI-personalised
// reasons. Refresh busts the AI cache (rate-limited in core).
import { useState } from "react";
import { Link } from "react-router";
import { BookStatusControl } from "~/components/book-status-control";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
import { Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import type { Recommendation } from "@foxing/core";
import { requireProfile } from "~/lib/profile.server";
import { loadRecommendations } from "~/lib/recommendations.server";
import type { Route } from "./+types/find-next-book";

export function meta() {
  return [{ title: "Find your next book | Foxing" }, { name: "robots", content: "noindex" }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  const { recommendations, aiPersonalized, isPlus } = await loadRecommendations(env, user.id, {
    refresh,
  });
  return { recommendations, aiPersonalized, isPlus };
}

export default function FindNextBook({ loaderData }: Route.ComponentProps) {
  const { recommendations, aiPersonalized, isPlus } = loaderData;
  const [paywallOpen, setPaywallOpen] = useState(false);

  return (
    <PageShell>
      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <PageHeader
            eyebrow="For you"
            title="Find your next book"
            lede={
              aiPersonalized
                ? "Picks chosen for your reading, with a reason for each."
                : "Picks drawn from what you read and love, with a reason for each."
            }
            className="mb-0"
          />
          <Link
            to="/find-next-book?refresh=1"
            className="shrink-0 rounded-md border border-border-interactive px-4 py-2 font-ui text-sm text-primary transition hover:bg-hover"
          >
            Refresh
          </Link>
        </div>

        {!isPlus ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-sunken px-4 py-3">
            <p className="font-ui text-sm text-secondary">
              Plus tunes these to you with AI-personalized reasons.
            </p>
            <button
              type="button"
              onClick={() => setPaywallOpen(true)}
              className="shrink-0 font-ui text-sm font-medium text-brand-text hover:underline"
            >
              Upgrade for AI-personalized picks
            </button>
          </div>
        ) : null}

        {recommendations.length === 0 ? (
          <EmptyState
            title="No recommendations yet."
            body="Add a few books to your library and check back."
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {recommendations.map((rec) => (
              <RecCard key={rec.bookId} rec={rec} />
            ))}
          </div>
        )}
      </Container>
      <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} />
    </PageShell>
  );
}

function RecCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="flex flex-col rounded-card border border-border-subtle bg-surface p-2.5">
      <Link to={`/books/${rec.slug}`} className="group block">
        <CoverImage
          src={rec.coverUrl}
          alt={`${rec.title} by ${rec.author}`}
          fallbackLabel={rec.title}
          sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw"
        />
      </Link>
      <div className="mt-3 flex flex-1 flex-col px-0.5">
        <Link to={`/books/${rec.slug}`} className="group">
          <h3 className="font-display text-base leading-snug text-primary transition-colors group-hover:text-brand-text">
            {rec.title}
          </h3>
        </Link>
        <p className="mt-1 font-ui text-sm text-tertiary">
          {rec.author}
          {rec.publicationYear ? <span> &middot; {rec.publicationYear}</span> : null}
        </p>
        <p className="mt-2 font-ui text-xs text-brand-text" data-testid="rec-reason">
          {rec.reason}
        </p>
        <div className="mt-auto pt-3">
          <BookStatusControl bookId={rec.bookId} currentStatus={null} signedIn loginHref="/login" />
        </div>
      </div>
    </div>
  );
}
