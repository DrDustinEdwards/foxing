// The Foxing Admin tool list; each group lives in its own tools-*.ts and every tool is an authenticated request to /api/v1/admin (tool-kit.ts).
import { catalogTools } from "./tools-catalog";
import { picksTools } from "./tools-picks";
import { userTools } from "./tools-users";
import type { ToolDefinition } from "./tool-kit";

export const TOOLS: ToolDefinition[] = [...userTools, ...catalogTools, ...picksTools];
