// Edit a reading list at /lists/:id/edit. Owner-gated in the loader. The form PATCHes
// /api/v1/lists/:id.
import { createDb, socialRepo } from "@foxing/core";
import { PageShell } from "~/components/page-shell";
import { ListForm } from "~/components/social/list-form";
import { Container, PageHeader } from "~/components/ui";
import { cloudflareContext } from "~/context";
import { requireProfile } from "~/lib/profile.server";
import type { Route } from "./+types/list-edit";

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireProfile(env, request);
  const list = await socialRepo.getListById(createDb(env.DB), params.id);
  if (!list || list.userId !== user.id) throw new Response("Not found", { status: 404 });
  return {
    list: {
      id: list.id,
      title: list.title,
      description: list.description,
      isPublic: list.isPublic,
    },
  };
}

export function meta() {
  return [{ title: "Edit list | Foxing" }, { name: "robots", content: "noindex" }];
}

export default function ListEdit({ loaderData }: Route.ComponentProps) {
  const { list } = loaderData;
  return (
    <PageShell>
      <Container>
        <PageHeader eyebrow="Lists" title="Edit list" />
        <ListForm
          mode="edit"
          listId={list.id}
          redirectTo={`/lists/${list.id}`}
          initial={{ title: list.title, description: list.description, isPublic: list.isPublic }}
        />
      </Container>
    </PageShell>
  );
}

// It hydrates (root.tsx, the `hydrate` handle).
export const handle = { hydrate: true };
