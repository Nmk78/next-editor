import { apiClient } from "../apiClient";
import type { AuthorSummary, PlaylistSummary } from "../../db/types";
import type { Lesson } from "../../lessons/types";

/** What a search shows: its authors and playlists, and every lesson loaded so far. */
export interface SearchResults {
  authors: AuthorSummary[];
  playlists: PlaylistSummary[];
  lessons: Lesson[];
}

/** One page of GET /api/search. Authors and playlists come with page 0 only. */
export interface SearchPage {
  authors: AuthorSummary[];
  /** Absent from a Worker older than playlist search. */
  playlists?: PlaylistSummary[];
  lessons: Lesson[];
  /** The page after this one, or null at the last. Absent from a Worker older than paging. */
  nextPage?: number | null;
}

export async function search(q: string, page = 0): Promise<SearchPage> {
  const res = await apiClient.get<SearchPage>("/search", {
    params: page > 0 ? { q, page } : { q },
  });
  return res.data;
}
