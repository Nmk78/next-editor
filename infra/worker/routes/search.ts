import { Hono } from "hono";
import type { Env } from "../env";
import { searchPublishedLessons, searchUsers } from "../../db/queries";
import { searchPublishedPlaylists } from "../../db/playlistQueries";
import {
  lessonRowToLesson,
  playlistRowToPlaylistSummary,
  userRowToAuthorSummary,
} from "../../db/types";

const AUTHOR_LIMIT = 6;
const PLAYLIST_LIMIT = 6;
/** Lessons per page of results. */
const LESSON_LIMIT = 24;

// Mounted at /api/search in worker/index.ts. Public — searches every
// published lesson, every user and every public playlist, not just what the
// client has paged in. Authors and playlists are returned alongside (not
// filtered into) lessons; the client renders them first per the product
// requirement. Lessons page like the gallery: `?page=N` (from 0) answers the
// next LESSON_LIMIT matches and `nextPage` says whether there are more. Authors
// and playlists come with page 0 only.
export const searchRoute = new Hono<{ Bindings: Env }>();

searchRoute.get("/", async (c) => {
  // Bound query length: a long %…% pattern with a leading wildcard forces a
  // full-table scan, so we cap it defensively at 100 characters.
  const q = (c.req.query("q") ?? "").trim().slice(0, 100);
  const pageParam = c.req.query("page");
  const page = pageParam ? Number(pageParam) : 0;
  if (!Number.isInteger(page) || page < 0) {
    return c.json({ error: "invalid page" }, 400);
  }
  const offset = page * LESSON_LIMIT;
  if (!q || !Number.isSafeInteger(offset)) {
    return c.json({ authors: [], playlists: [], lessons: [], nextPage: null });
  }

  // One row past the page says whether another page follows.
  const [authorRows, playlistRows, lessonRows] = await Promise.all([
    page === 0 ? searchUsers(c.env.DB, q, AUTHOR_LIMIT) : [],
    page === 0 ? searchPublishedPlaylists(c.env.DB, q, PLAYLIST_LIMIT) : [],
    searchPublishedLessons(c.env.DB, q, LESSON_LIMIT + 1, offset),
  ]);
  const hasNextPage = lessonRows.length > LESSON_LIMIT;

  return c.json({
    authors: authorRows.map(userRowToAuthorSummary),
    playlists: playlistRows.map(playlistRowToPlaylistSummary),
    lessons: lessonRows.slice(0, LESSON_LIMIT).map(lessonRowToLesson),
    nextPage: hasNextPage ? page + 1 : null,
  });
});
