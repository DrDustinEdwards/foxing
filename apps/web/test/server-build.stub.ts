// The React Router server build, for tests that run the real Worker entry (workers/app.ts): the
// real server entry and the real root (its Layout, loader and error boundary) around two stand-in
// pages, a cacheable public page and the reader. vitest.config.ts aliases
// virtual:react-router/server-build here, so what the security-headers test grades is what the
// real document shell renders, its inline scripts and nonces included.
import { createElement as h } from "react";
import { publicPageHeaders } from "@dustinedwards/site-runtime/edge-cache";
import { UNSAFE_withErrorBoundaryProps, type ServerBuild } from "react-router";
import * as entryServer from "../app/entry.server";
import * as rootModule from "../app/root";

const Page = () =>
  h("main", { id: "main" }, h("img", { src: "https://covers.foxing.app/x.jpg", alt: "" }));
const publicPage = {
  default: Page,
  headers: () => publicPageHeaders(),
};

function assetRoute(id: string, path: string | undefined, hasLoader: boolean, parentId?: string) {
  return {
    id,
    parentId,
    path,
    index: path === undefined ? true : undefined,
    module: `/stub-${id}.js`,
    imports: [],
    hasLoader,
    hasAction: false,
    hasClientLoader: false,
    hasClientAction: false,
    hasClientMiddleware: false,
    hasErrorBoundary: id === "root",
  };
}

const build = {
  entry: { module: entryServer },
  routes: {
    root: {
      id: "root",
      path: "",
      module: {
        ...rootModule,
        ErrorBoundary: UNSAFE_withErrorBoundaryProps(rootModule.ErrorBoundary),
      },
    },
    home: { id: "home", parentId: "root", index: true, module: publicPage },
    read: { id: "read", parentId: "root", path: "read/:slug", module: { default: Page } },
  },
  assets: {
    entry: { imports: [], module: "/stub-entry.js" },
    routes: {
      root: assetRoute("root", "", true),
      home: assetRoute("home", undefined, false, "root"),
      read: assetRoute("read", "read/:slug", false, "root"),
    },
    url: "/stub-manifest.js",
    version: "stub",
  },
  basename: "/",
  publicPath: "/",
  assetsBuildDirectory: "build/client",
  future: {},
  ssr: true,
  isSpaMode: false,
  prerender: [],
  routeDiscovery: { mode: "initial", manifestPath: "/__manifest" },
  unstable_getCriticalCss: undefined,
} as unknown as ServerBuild;

export default build;
export const {
  entry,
  routes,
  assets,
  basename,
  publicPath,
  assetsBuildDirectory,
  future,
  ssr,
  isSpaMode,
  prerender,
  routeDiscovery,
} = build;
