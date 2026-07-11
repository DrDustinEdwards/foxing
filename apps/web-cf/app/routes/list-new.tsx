// Create a reading list at /lists/new. The form POSTs /api/v1/lists and navigates to
// the new list. A public list emits a list_created feed event server-side.
import { PageShell } from "~/components/page-shell";
import { ListForm } from "~/components/social/list-form";
import { Container, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/list-new";

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { profile } = await requireProfile(env, request);
  return { username: profile.username };
}

export function meta() {
  return [{ title: "New list | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function ListNew({ loaderData }: Route.ComponentProps) {
  return (
    <PageShell>
      <Container className="max-w-2xl">
        <PageHeader eyebrow="Lists" title="New reading list" />
        <ListForm mode="create" redirectTo={`/u/${loaderData.username}`} />
      </Container>
    </PageShell>
  );
}
