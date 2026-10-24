// Club hooks: the clubs index, a club page, a thread, every club write, and the live
// socket. Writes patch the open page and refetch only it; the socket tells open
// screens another member changed something, so they refetch (or, for poll tallies,
// patch in place) without a reload.
import { type ClubLiveMessage, PING_FRAME } from "@foxing/types";
import type * as W from "@foxing/types";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { keys } from "./keys";
import { useApi } from "./provider";
import { patch, useSeededQuery, useWrite } from "./query";

// --- Reads ------------------------------------------------------------------

export function useClubsIndex<S extends W.ClubsIndex | undefined = undefined>(seed?: S) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.clubsIndex,
      queryFn: async () => {
        const [mine, discover] = await Promise.all([
          api.get<{ clubs: W.ClubCard[] }>("/clubs/mine"),
          api.get<{ clubs: W.ClubCard[] }>("/clubs"),
        ]);
        const mineIds = new Set(mine.clubs.map((c) => c.id));
        return { mine: mine.clubs, discover: discover.clubs.filter((c) => !mineIds.has(c.id)) };
      },
    },
    seed,
  );
}

export function useClubPage<S extends W.ClubPage | undefined = undefined>(
  idOrSlug: string,
  seed?: S,
) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.clubPage(idOrSlug),
      queryFn: () => api.get<W.ClubPage>(`/clubs/${encodeURIComponent(idOrSlug)}`),
    },
    seed,
  );
}

export function useThreadPage<S extends W.ThreadPage | undefined = undefined>(
  threadId: string,
  seed?: S,
) {
  const api = useApi();
  return useSeededQuery(
    {
      queryKey: keys.thread(threadId),
      queryFn: () => api.get<W.ThreadPage>(`/threads/${threadId}`),
    },
    seed,
  );
}

/** Patches every open page of one club. */
function patchClub(clubId: string, update: (page: W.ClubPage) => W.ClubPage) {
  return patch<W.ClubPage>(keys.clubPages, (page) =>
    page.club.id === clubId ? update(page) : page,
  );
}

// --- Membership -------------------------------------------------------------

export function useJoinClub() {
  const api = useApi();
  return useWrite<{ clubId: string }>({
    write: ({ clubId }) => api.post(`/clubs/${clubId}/join`),
    invalidates: () => [keys.clubs],
  });
}

export function useJoinByCode() {
  const api = useApi();
  return useWrite<{ code: string }, { club: { id: string; slug: string | null } }>({
    write: ({ code }) => api.post(`/join/${encodeURIComponent(code)}`),
    invalidates: () => [keys.clubs],
  });
}

export function useLeaveClub() {
  const api = useApi();
  return useWrite<{ clubId: string }>({
    write: ({ clubId }) => api.delete(`/clubs/${clubId}/members/me`),
    invalidates: () => [keys.clubs],
  });
}

export function useRotateInviteCode() {
  const api = useApi();
  return useWrite<{ clubId: string }, { joinCode: string }>({
    write: ({ clubId }) => api.post(`/clubs/${clubId}/invite-code`),
    invalidates: () => [keys.clubPages],
  });
}

export function useCreateClub() {
  const api = useApi();
  return useWrite<Record<string, unknown>, { club: { id: string; slug: string | null } }>({
    write: (input) => api.post("/clubs", input),
    invalidates: () => [keys.clubsIndex],
  });
}

// --- Threads and posts ------------------------------------------------------

export function useCreateThread() {
  const api = useApi();
  return useWrite<
    { clubId: string; title: string; body?: string; chapter?: string; bookId?: string },
    { thread: { id: string } }
  >({
    write: ({ clubId, ...input }) => api.post(`/clubs/${clubId}/threads`, input),
    invalidates: () => [keys.clubPages],
  });
}

export function useCreatePost() {
  const api = useApi();
  return useWrite<{ threadId: string; content: string; parentPostId?: string }>({
    write: ({ threadId, ...input }) => api.post(`/threads/${threadId}/posts`, input),
    invalidates: ({ threadId }) => [keys.thread(threadId)],
  });
}

export function useRemovePost() {
  const api = useApi();
  return useWrite<{ threadId: string; postId: string; reason?: string }>({
    write: ({ postId, reason }) => api.delete(`/posts/${postId}`, reason ? { reason } : undefined),
    optimistic: ({ threadId, postId }) => [
      patch<W.ThreadPage>(keys.thread(threadId), (t) => ({
        ...t,
        posts: t.posts.filter((p) => p.id !== postId),
      })),
    ],
    invalidates: ({ threadId }) => [keys.thread(threadId)],
  });
}

// --- Polls ------------------------------------------------------------------

export function useCreatePoll() {
  const api = useApi();
  return useWrite<{
    clubId: string;
    title: string;
    pollType: "single" | "irv";
    options: { id: string; label: string; bookId?: string }[];
  }>({
    write: ({ clubId, ...input }) => api.post(`/clubs/${clubId}/polls`, input),
    invalidates: () => [keys.clubPages],
  });
}

export function useVotePoll() {
  const api = useApi();
  return useWrite<{ clubId: string; pollId: string; ranks: string[] }>({
    write: ({ pollId, ranks }) => api.post(`/polls/${pollId}/vote`, { ranks }),
    optimistic: ({ clubId, pollId, ranks }) => [
      patchClub(clubId, (page) => ({
        ...page,
        polls: page.polls.map((p) => {
          if (p.id !== pollId) return p;
          const tallies = { ...p.tallies };
          const before = p.myVote?.[0];
          if (before) tallies[before] = Math.max(0, (tallies[before] ?? 0) - 1);
          if (ranks[0]) tallies[ranks[0]] = (tallies[ranks[0]] ?? 0) + 1;
          return { ...p, tallies, myVote: ranks, voteCount: p.voteCount + (p.myVote ? 0 : 1) };
        }),
      })),
    ],
    invalidates: () => [keys.clubPages],
  });
}

export function useClosePoll() {
  const api = useApi();
  return useWrite<{ clubId: string; pollId: string }>({
    write: ({ pollId }) => api.post(`/polls/${pollId}/close`),
    optimistic: ({ clubId, pollId }) => [
      patchClub(clubId, (page) => ({
        ...page,
        polls: page.polls.map((p) => (p.id === pollId ? { ...p, isClosed: true } : p)),
      })),
    ],
    invalidates: () => [keys.clubPages],
  });
}

// --- Meetings and schedule --------------------------------------------------

export function useCreateMeeting() {
  const api = useApi();
  return useWrite<{ clubId: string; title: string; meetingDate: number; description?: string }>({
    write: ({ clubId, ...input }) => api.post(`/clubs/${clubId}/meetings`, input),
    invalidates: () => [keys.clubPages],
  });
}

export function useCancelMeeting() {
  const api = useApi();
  return useWrite<{ clubId: string; meetingId: string }>({
    write: ({ meetingId }) => api.post(`/meetings/${meetingId}/cancel`),
    optimistic: ({ clubId, meetingId }) => [
      patchClub(clubId, (page) => ({
        ...page,
        meetings: page.meetings.map((m) => (m.id === meetingId ? { ...m, isCancelled: true } : m)),
      })),
    ],
    invalidates: () => [keys.clubPages],
  });
}

export function useRsvp() {
  const api = useApi();
  return useWrite<{ clubId: string; meetingId: string; status: W.RsvpStatus }>({
    write: ({ meetingId, status }) => api.post(`/meetings/${meetingId}/rsvp`, { status }),
    optimistic: ({ clubId, meetingId, status }) => [
      patchClub(clubId, (page) => ({
        ...page,
        meetings: page.meetings.map((m) => {
          if (m.id !== meetingId) return m;
          const rsvps = { ...m.rsvps };
          if (m.myRsvp) rsvps[m.myRsvp] = Math.max(0, rsvps[m.myRsvp] - 1);
          rsvps[status] += 1;
          return { ...m, rsvps, myRsvp: status };
        }),
      })),
    ],
    invalidates: () => [keys.clubPages],
  });
}

export function useAddSchedule() {
  const api = useApi();
  return useWrite<{ clubId: string; chapterName: string; unlockDate: number }>({
    write: ({ clubId, ...input }) => api.post(`/clubs/${clubId}/schedule`, input),
    invalidates: () => [keys.clubPages],
  });
}

export function useRemoveSchedule() {
  const api = useApi();
  return useWrite<{ clubId: string; scheduleId: string }>({
    write: ({ clubId, scheduleId }) => api.delete(`/clubs/${clubId}/schedule/${scheduleId}`),
    optimistic: ({ clubId, scheduleId }) => [
      patchClub(clubId, (page) => ({
        ...page,
        schedule: page.schedule.filter((s) => s.id !== scheduleId),
      })),
    ],
    invalidates: () => [keys.clubPages],
  });
}

// --- Live -------------------------------------------------------------------

/** Opens a club's live socket while clubId is set (members only; the server refuses
 *  anyone else). New threads and notices refetch the club page, new posts refetch
 *  their thread, and poll tallies are patched straight into the cache. */
export function useClubLive(clubId: string | null) {
  const api = useApi();
  const qc = useQueryClient();
  const [presence, setPresence] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const deps = useRef({ api, qc });
  deps.current = { api, qc };

  useEffect(() => {
    if (!clubId) return;
    const { api, qc } = deps.current;
    const ws = api.socket(`/clubs/${clubId}/live`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      let msg: ClubLiveMessage;
      try {
        msg = JSON.parse(String(event.data)) as ClubLiveMessage;
      } catch {
        return;
      }
      switch (msg.t) {
        case "presence":
          setPresence(msg.users);
          break;
        case "post":
          void qc.invalidateQueries({ queryKey: keys.thread(msg.post.threadId) });
          break;
        case "thread":
        case "notice":
          void qc.invalidateQueries({ queryKey: keys.clubPages });
          break;
        case "tally":
          qc.setQueriesData<W.ClubPage>({ queryKey: keys.clubPages }, (page) =>
            page && page.club.id === clubId
              ? {
                  ...page,
                  polls: page.polls.map((p) =>
                    p.id === msg.poll_id
                      ? { ...p, tallies: msg.tallies, isClosed: p.isClosed || !!msg.closed }
                      : p,
                  ),
                }
              : page,
          );
          break;
      }
    };
    // Keepalive so idle sockets are not reaped; the runtime answers with a pong
    // through the ClubRoom's auto-response, without waking the object.
    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(PING_FRAME);
    }, 30_000);
    return () => {
      clearInterval(ping);
      ws.close();
      setPresence([]);
      setConnected(false);
    };
  }, [clubId]);

  return { presence, connected };
}
