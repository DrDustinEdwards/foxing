import { PageShell } from "~/components/page-shell";
import { ListForm } from "~/components/social/list-form";
import { Container, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/list-new";
import { noindexPageMeta } from "~/lib/seo";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { profile } = await requireProfile(env, request);
  return { username: profile.username };
}

export function meta() {
  return noindexPageMeta("New list | Foxing");
}

export default function ListNew({ loaderData }: Route.ComponentProps) {
  return (
    <PageShell>
      <Container>
        <PageHeader title="New reading list" />
        <ListForm mode="create" redirectTo={`/u/${loaderData.username}`} />
      </Container>
    </PageShell>
  );
}

export const handle = { hydrate: true };
