// Privacy policy. Static content, edge-cached. The infrastructure / subprocessor
// and storage sections describe the real Cloudflare-native stack (D1, R2, KV,
// Workers, Email Sending), not the legacy Supabase/Vercel stack. Sections for
// payments and the AI companion describe processing that begins when those
// features ship, phrased in the future so nothing overstates today.
import { PageShell } from "~/components/page-shell";
import { LegalDoc, type LegalSection } from "capsomer/react/legal-doc";
import "capsomer/legal-doc.css";
import { Container } from "~/components/ui";
import { staticPageHeaders } from "~/lib/loader.server";
import { PRIVACY_EMAIL } from "~/lib/origins";
import { buildMeta } from "~/lib/seo";
import type { Route } from "./+types/privacy";

const UPDATED = "2026-07-10";

const SECTIONS: LegalSection[] = [
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <p>
        Your account email and name, the books on your shelves and their reading status, your
        reading progress and streaks, the highlights and notes you save, the reading goals you set,
        and the profile details you choose to add: username, display name, bio, and avatar. If you
        mark something private it stays private. If you post it in a public space it is public.
      </p>
    ),
  },
  {
    id: "how-we-use-it",
    title: "How we use it",
    body: (
      <p>
        To run the product: your library, your reading position, your goals and streaks. To answer
        your support email. That is the whole list. We do not build advertising profiles and we do
        not sell your data.
      </p>
    ),
  },
  {
    id: "where-your-data-lives",
    title: "Where your data lives",
    body: (
      <p>
        Foxing runs on Cloudflare. Your account and library data are stored in Cloudflare D1, our
        database. Book files, cover images, and avatars are stored in Cloudflare R2. Sessions live
        in D1 too, and cached pages in Cloudflare KV. The application itself runs as a Cloudflare
        Worker. Transactional email, such as sign-in links and codes, is sent through Cloudflare
        Email Sending. If you sign in with Google or Apple, Foxing receives your name and email
        address from them and keeps none of their access tokens. A passkey leaves only its public
        key with Foxing; the private key stays on your device. Data is processed in Cloudflare's
        network under its data processing terms.
      </p>
    ),
  },
  {
    id: "payments",
    title: "Payments",
    body: (
      <p>
        Foxing is free today. When paid plans launch, payments will be handled by Stripe. Foxing
        never sees or stores your card number; Stripe processes it directly under its own terms.
      </p>
    ),
  },
  {
    id: "ai-features",
    title: "AI features",
    body: (
      <p>
        When the AI reading companion launches, the passage you select and the book's metadata are
        sent to our AI provider to generate a response. The provider does not train its models on
        your data per its API terms, and nothing else is sent.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        We set a session cookie so you stay signed in, and it doubles as protection against
        cross-site request forgery. When bot protection is enabled, the sign-up form may set a
        short-lived verification token. There are no third-party advertising cookies and no
        cross-site tracking.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <p>
        You can see, correct, export, and delete your data. From settings you can download a JSON
        archive of everything tied to your account, and you can delete your account outright. If you
        live somewhere with a privacy law such as the GDPR or the CCPA, those rights apply, and we
        honor them for everyone regardless.
      </p>
    ),
  },
  {
    id: "retention-and-deletion",
    title: "Retention and deletion",
    body: (
      <p>
        Delete your account at any time from settings. Your profile, library, reading history,
        highlights, notes, and goals are removed when you do. A club you created passes to the
        member you choose, so its members keep their discussions; a club with no other members is
        deleted. Operational backups are purged on a rolling basis after that.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        Foxing is not intended for children under 13, and we do not knowingly collect their data. If
        you believe a child under 13 has an account, write to the address below and we will remove
        it.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        <a href={`mailto:${PRIVACY_EMAIL}`} className="link">
          {PRIVACY_EMAIL}
        </a>
      </p>
    ),
  },
];

export const headers = staticPageHeaders;

export function meta({ location }: Route.MetaArgs) {
  return buildMeta({
    title: "Privacy",
    description:
      "What Foxing collects, where your data is stored, and the rights you have over it.",
    pathname: location.pathname,
  });
}

export default function Privacy() {
  return (
    <PageShell>
      <Container className="measure-prose">
        <LegalDoc title="Privacy" updated={UPDATED} sections={SECTIONS} />
      </Container>
    </PageShell>
  );
}
