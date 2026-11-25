import { PRIVATE_PAGE_HEADERS } from "@dustinedwards/site-runtime/edge-cache";
import { Outlet } from "react-router";

// no-transform keeps Cloudflare's Web Analytics beacon out of private pages, and the Worker compresses them itself (PRIVATE_PAGE_HEADERS).
export const headers = () => PRIVATE_PAGE_HEADERS;

export default function PrivatePages() {
  return <Outlet />;
}
