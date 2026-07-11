// @foxing/core public surface. Drizzle schema, zod enums/validators, domain logic,
// repositories, and the event emitter. Pure TS, zero framework imports: this is the
// package Foxing Edu reuses in its own Worker.
export * as schema from "./schema";
export * from "./db";
export * from "./enums";
export * from "./validators";
export * from "./repositories";
export * from "./events";
export * from "./domain";
export * from "./config";
export * as companion from "./companion";
export type * from "./companion";
