import { PRIVATE_PAGE_HEADERS } from "@dustinedwards/site-runtime/edge-cache";
import { Outlet } from "react-router";

// Every page under this layout is private (signed in, or admin): no-transform keeps Cloudflare's Web Analytics beacon
// out, so only public pages are counted, and the Worker compresses the page itself (site-runtime PRIVATE_PAGE_HEADERS).
export const headers = () => PRIVATE_PAGE_HEADERS;

export default function PrivatePages() {
  return <Outlet />;
}
