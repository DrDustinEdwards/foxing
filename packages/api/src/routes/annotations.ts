// Reader annotation + reading-progress surface. The web reader and mobile write here,
// and read their own annotations back. Handlers stay
// thin: session, validate, call core. createAnnotation goes through the domain seam
// so a new highlight inherits the reader's default-annotation visibility.
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

// The reader social layers for one book: the viewer's own annotations, the entitled
// club/friend/public annotations of OTHERS (each tagged with the layer that admitted
// it), the club passage discussion, and the popular-highlights aggregation. Session is
// optional: anonymous readers resolve to public + popular only. All entitlement is
// resolved server-side in core; the client only toggles which returned layers it shows.
// ?layers= trims the payload (mine,club,friend,public,popular,comments); ?progressGate=off
// skips the automatic ahead-of-you gate (the manual spoiler flag always applies).
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

// The reader's own annotations across books, filtered by ?types=highlight,note,...
annotationRoutes.get("/annotations", async (c) => {
  const session = requireSession(c);
  const types = (c.req.query("types") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is AnnotationType => (annotationTypeValues as readonly string[]).includes(t));
  return c.json({ annotations: await views.myAnnotations(c.get("db"), session.id, types) });
});

// Create a highlight/note/bookmark. Body carries the bookId; visibility is optional
// and, when absent, resolved from the reader's default-annotation preference in core.
annotationRoutes.post("/annotations", rateLimit("write"), async (c) => {
  requireSession(c);
  const profile = c.get("profile");
  if (!profile) throw errors.forbidden("Complete your profile to save annotations.");
  const input = await parseJson(c, createAnnotationInput);
  const annotation = await annotationsDomain.createAnnotation(c.get("db"), profile, input);
  return c.json({ annotation }, 201);
});

// Create a passage comment (reply to a highlight, or a comment on a passage). Always
// club-scoped; core enforces active membership of that club BEFORE inserting, so a
// non-member's post is rejected 403 and never reaches the table.
annotationRoutes.post("/annotations/comments", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const input = await parseJson(c, createPassageCommentInput);
  const annotation = await annotationsDomain.createPassageComment(c.get("db"), session.id, input);
  return c.json({ annotation }, 201);
});

// Update body/color/visibility/pin/spoiler. Ownership-scoped in core.
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

// Save reading position (debounced from the reader). bookId in the path; the Locator
// + whole-book percentage in the body. First write starts the book (status reading).
annotationRoutes.put("/books/:bookId/progress", rateLimit("write"), async (c) => {
  const session = requireSession(c);
  const body = await parseJson(c, saveProgressInput.omit({ bookId: true }));
  const userBook = await libraryRepo.upsertProgress(c.get("db"), session.id, {
    ...body,
    bookId: c.req.param("bookId"),
  });
  return c.json({ progressPct: userBook.progressPct });
});
