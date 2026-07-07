import { Link } from "react-router";
import { cloudflareContext } from "~/context";
import { getAuth } from "~/lib/auth.server";
import type { Route } from "./+types/home";

export function meta() {
  return [{ title: "Foxing" }, { name: "description", content: "Letterboxd for books." }];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getAuth(env).api.getSession({ headers: request.headers });
  return { email: session?.user.email ?? null };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <main>
      <h1>Foxing</h1>
      {loaderData.email ? (
        <p>
          Signed in as {loaderData.email}. <Link to="/me">Your profile</Link>
        </p>
      ) : (
        <p>
          <Link to="/signup">Create an account</Link> or <Link to="/login">sign in</Link>.
        </p>
      )}
    </main>
  );
}
