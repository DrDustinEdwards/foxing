// Privacy policy. Static content, edge-cached. The infrastructure / subprocessor
// and storage sections describe the real Cloudflare-native stack (D1, R2, KV,
// Workers, Email Sending), not the legacy Supabase/Vercel stack. Sections for
// payments and the AI companion describe processing that begins when those
// features ship (Phase 4), phrased in the future so nothing overstates today.
import { PageShell } from "~/components/page-shell";
import { Container, PageHeader } from "~/components/ui";
import { loaderBase, publicCacheHeaders } from "~/lib/loader.server";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/privacy";

const LAST_UPDATED = "10 July 2026";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { origin } = loaderBase(context, request);
  return { origin };
}

export function headers(): HeadersInit {
  return publicCacheHeaders(3600, 604800);
}

export function meta({ loaderData: data, location }: Route.MetaArgs) {
  if (!data) return [{ title: "Privacy | Foxing" }];
  return buildMeta({
    title: "Privacy",
    description:
      "What Foxing collects, where your data is stored, and the rights you have over it.",
    origin: data.origin,
    pathname: location.pathname,
  });
}

export default function Privacy() {
  return (
    <PageShell>
      <Container className="max-w-prose">
        <PageHeader eyebrow={`Last updated ${LAST_UPDATED}`} title="Privacy" />

        <div className="space-y-8 font-ui text-base leading-relaxed text-secondary">
          <Section heading="What we collect">
            Your account email and name, the books on your shelves and their reading status,
            your reading progress and streaks, the highlights and notes you save, the reading
            goals you set, and the profile details you choose to add: username, display name,
            bio, and avatar. If you mark something private it stays private. If you post it in a
            public space it is public.
          </Section>

          <Section heading="How we use it">
            To run the product: your library, your reading position, your goals and streaks. To
            answer your support email. That is the whole list. We do not build advertising
            profiles and we do not sell your data.
          </Section>

          <Section heading="Where your data lives">
            Foxing runs on Cloudflare. Your account and library data are stored in Cloudflare
            D1, our database. Book files, cover images, and avatars are stored in Cloudflare R2.
            Sessions and cached pages live in Cloudflare KV. The application itself runs as a
            Cloudflare Worker. Transactional email, such as sign-in verification and password
            resets, is sent through Cloudflare Email Sending. Data is processed in Cloudflare's
            network under its data processing terms.
          </Section>

          <Section heading="Payments">
            Foxing is free today. When paid plans launch, payments will be handled by Stripe.
            Foxing never sees or stores your card number; Stripe processes it directly under its
            own terms.
          </Section>

          <Section heading="AI features">
            When the AI reading companion launches, the passage you select and the book's
            metadata are sent to our AI provider to generate a response. The provider does not
            train its models on your data per its API terms, and nothing else is sent.
          </Section>

          <Section heading="Cookies">
            We set a session cookie so you stay signed in, and it doubles as protection against
            cross-site request forgery. When bot protection is enabled, the sign-up form may set
            a short-lived verification token. There are no third-party advertising cookies and
            no cross-site tracking.
          </Section>

          <Section heading="Your rights">
            You can see, correct, export, and delete your data. From settings you can download a
            JSON archive of everything tied to your account, and you can delete your account
            outright. If you live somewhere with a privacy law such as the GDPR or the CCPA,
            those rights apply, and we honor them for everyone regardless.
          </Section>

          <Section heading="Retention and deletion">
            Delete your account at any time from settings. Your profile, library, reading
            history, highlights, notes, and goals are removed when you do. Operational backups
            are purged on a rolling basis after that.
          </Section>

          <Section heading="Children">
            Foxing is not intended for children under 13, and we do not knowingly collect their
            data. If you believe a child under 13 has an account, write to the address below and
            we will remove it.
          </Section>

          <Section heading="Contact">
            <a href="mailto:privacy@foxing.app" className="text-brand-text hover:underline">
              privacy@foxing.app
            </a>
          </Section>
        </div>
      </Container>
    </PageShell>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-primary">{heading}</h2>
      <p className="mt-2">{children}</p>
    </section>
  );
}
