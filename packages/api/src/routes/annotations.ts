// Thin handlers: session, validate, call core. createAnnotation goes through the domain seam so a new highlight inherits the reader's default visibility.
import { Hono } from "hono";
import {
  annotationsDomain,
  annotationsRepo,
  createAnnotationInput,
  createPassageCommentInput,
  libraryRepo,
  loadReaderAnnotations,
  saveProgressInput,
  type AnnotationType,
  annotationTypeValues,
  updateAnnotationInput,
  views,
} from "@foxing/core";
import { errors } from "../error";
import { parseJson, requireSession } from "../http";
import { rateLimit } from "../middleware/rate-limit";
import type { Env } from "../types";

export const annotationRoutes = new Hono<Env>();

// The reader's social layers for one book. Session optional: anonymous resolves to public + popular only. Entitlement is resolved server-side in core; the client only toggles layers.
// ?layers= trims the payload (mine,club,friend,public,popular,comments); ?progressGate=off skips the automatic ahead-of-you gate (the manual spoiler flag always applies).
annotationRoutes.get("/books/:id/annotations", async (c) => {
  const session = c.get("session");
  const progressGate = c.req.query("progressGate") !== "off";
  const result = await loadReaderAnnotations(c.get("db"), session?.id ?? null, c.req.param("id"), {
    progressGate,
  });

  const layersParam = c.req.query("layers");
  if (!layersParam) return c.json(result);

  const wanted = new Set(
    layersParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return c.json({
    viewerProgressPct: result.viewerProgressPct,
    mine: wanted.has("mine") ? result.mine : [],
    others: result.others.filter((o) => wanted.has(o.layer)),
    comments: wanted.has("comments") ? result.comments : [],
    popular: wanted.has("popular") ? result.popular : [],
  });
});

annotationRoutes.get("/annotations", async (c) => {
  const session = requireSession(c);
  const types = (c.req.query("types") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is AnnotationType => (annotationTypeValues as readonly string[]).includes(t));
  return c.json({ annotations: await views.myAnnotations(c.get("db"), session.id, types) });
});

annotationRoutes.post("/annotations", rateLimit("write"), async (c) => {
  requireSession(c);
  const profile = c.get("profile");
  if (!profile) throw errors.forbidden("Complete your profile to save annotations.");
  const input = await parseJson(c, createAnnotationInput);
  const annotation = await annotationsDomain.createAnnotation(c.get("db"), profile, input);
  return c.json({ annotation }, 201);
});

// Passage comment: always club-scoped; core enforces active membership BEFORE inserting, so a non-member gets 403.
annotationRoutes.post("/annotations/comments", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const input = await parseJson(c, createPassageCommentInput);
  const annotation = await annotationsDomain.createPassageComment(c.get("db"), session.id, input);
  return c.json({ annotation }, 201);
});

annotationRoutes.patch("/annotations/:id", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const body = await parseJson(c, updateAnnotationInput.omit({ id: true }));
  const annotation = await annotationsRepo.updateAnnotation(c.get("db"), session.id, {
    ...body,
    id: c.req.param("id"),
  });
  if (!annotation) throw errors.notFound("Annotation not found.");
  return c.json({ annotation });
});

annotationRoutes.delete("/annotations/:id", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const ok = await annotationsRepo.deleteAnnotation(c.get("db"), session.id, c.req.param("id"));
  if (!ok) throw errors.notFound("Annotation not found.");
  return c.json({ ok });
});

// Save reading position; the first write starts the book (status reading).
annotationRoutes.put("/books/:bookId/progress", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const body = await parseJson(c, saveProgressInput.omit({ bookId: true }));
  const userBook = await libraryRepo.upsertProgress(c.get("db"), session.id, {
    ...body,
    bookId: c.req.param("bookId"),
  });
  return c.json({ progressPct: userBook.progressPct });
});
