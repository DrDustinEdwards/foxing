#!/usr/bin/env node
// Writes public/_headers from the set the Worker applies (workers/header-set.ts). `pnpm build` runs it first, so the
// deployed file cannot drift; the committed copy is what devkit's family check reads (run this after changing the
// set). Node's type stripping loads the .ts module (Node 22.18 and later).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { staticHeadersFile } from "../workers/header-set.ts";

writeFileSync(fileURLToPath(new URL("../public/_headers", import.meta.url)), staticHeadersFile());
