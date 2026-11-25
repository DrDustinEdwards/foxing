// Find next book (auth-gated, noindex): free readers get data-driven picks, Plus readers AI reasons; Refresh busts the AI cache (rate-limited in core).
import { SIGN_IN_PATH } from "@dustinedwards/site-runtime/sign-in-path";
import { useState } from "react";
import { Link } from "capsomer/react/link";
import { Form, redirect } from "react-router";
import { BookStatusControl } from "~/components/book-status-control";
import { CoverImage } from "~/components/cover-image";
import { PageShell } from "~/components/page-shell";
import { Paywall } from "~/components/paywall";
import { Button, Container, EmptyState, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { billing, type Recommendation } from "@foxing/core";
import { requireProfile } from "~/lib/profile.server";
import { loadRecommendations } from "~/lib/recommendations.server";
import type { Route } from "./+types/find-next-book";
import { noindexMeta } from "~/lib/seo";

export function meta() {
  return noindexMeta("Find your next book | Foxing");
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const { recommendations, isPlus } = await loadRecommendations(env, user.id);
  const canUpgrade = !isPlus && billing.stripeSettings(env) !== null;
  return { recommendations, canUpgrade };
}

// Refresh is a POST, so a link or redirect from another site cannot spend a reader's AI budget.
export async function action({ context, request }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  await loadRecommendations(env, user.id, { refresh: true });
  return redirect("/find-next-book");
}

export default function FindNextBook({ loaderData }: Route.ComponentProps) {
  const { recommendations, canUpgrade } = loaderData;
  const [paywallOpen, setPaywallOpen] = useState(false);

  return (
    <PageShell>
      <Container className="cap-stack" data-gap="7">
        <PageHeader
          title="Find your next book"
          actions={
            <Form method="post">
              <Button type="submit" variant="secondary" className="cap-keep">
                Refresh
              </Button>
            </Form>
          }
        />

        {canUpgrade ? (
          <div className="py-3 fx-find-next-book-card">
            <p className="cap-text" data-size="small" data-tone="muted" data-face="ui">
              Plus tunes these to you with AI-personalized reasons.
            </p>
            <button
              type="button"
              onClick={() => setPaywallOpen(true)}
              className="cap-keep fx-find-next-book-btn"
            >
              Upgrade for AI-personalized picks
            </button>
          </div>
        ) : null}

        {recommendations.length === 0 ? (
          <EmptyState title="No recommendations yet." />
        ) : (
          <div className="fx-find-next-book-grid">
            {recommendations.map((rec) => (
              <RecCard key={rec.bookId} rec={rec} />
            ))}
          </div>
        )}
      </Container>
      {canUpgrade ? <Paywall open={paywallOpen} onClose={() => setPaywallOpen(false)} /> : null}
    </PageShell>
  );
}

function RecCard({ rec }: { rec: Recommendation }) {
  return (
    <div className="cap-card cap-stack fx-find-next-book-card-2" data-gap="5">
      <Link to={`/books/${rec.slug}`} className="block">
        <CoverImage
          src={rec.coverUrl}
          alt={`${rec.title} by ${rec.author}`}
          fallbackLabel={rec.title}
          sizes="(min-width: 64rem) 200px, (min-width: 40rem) 30vw, 45vw"
        />
      </Link>
      <div className="cap-stack fx-find-next-book-stack" data-gap="3">
        <div className="cap-stack" data-gap="2">
          <Link to={`/books/${rec.slug}`} className="group">
            <h3 className="fx-find-next-book-title">{rec.title}</h3>
          </Link>
          <p className="cap-text" data-size="small" data-tone="dim" data-face="ui">
            {rec.author}
            {rec.publicationYear ? <span> &middot; {rec.publicationYear}</span> : null}
          </p>
        </div>
        <p className="fx-find-next-book-text" data-testid="rec-reason">
          {rec.reason}
        </p>
        <div className="fx-find-next-book-box">
          <BookStatusControl
            book={{
              id: rec.bookId,
              slug: rec.slug,
              title: rec.title,
              author: rec.author,
              coverUrl: rec.coverUrl,
            }}
            currentStatus={null}
            signedIn
            loginHref={SIGN_IN_PATH}
          />
        </div>
      </div>
    </div>
  );
}

export const handle = { hydrate: true };
