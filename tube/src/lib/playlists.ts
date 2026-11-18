import type { PlaylistSummary } from "@next-editor/infra";
import type { PlaylistRef } from "../../../infra/lessons/types";
import type { Playlist } from "../types";
import { findCatalogItem, getCatalogJson } from "./catalogRequest";

// Playlists have no static seed shard (unlike lessons) — every playlist is
// user-created, so this always goes straight to the D1-backed API. Returns
// null (not undefined) on a real miss, same contract as findLessonBySlug.
export async function findPlaylistBySlug(slug: string): Promise<Playlist | null> {
  return findCatalogItem<Playlist>(`/api/playlists/${encodeURIComponent(slug)}`);
}

/**
 * Every public playlist, most recently updated first. A host without the
 * Worker (a static preview of the build) has none to offer, so the gallery
 * simply shows no playlist row there.
 */
export async function fetchPublicPlaylists(): Promise<PlaylistSummary[]> {
  const body = await getCatalogJson<{ playlists: PlaylistSummary[] }>("/api/playlists");
  return body?.playlists ?? [];
}

/**
 * The public playlists a lesson belongs to (none for a draft or unknown one).
 * A host without the Worker knows of none.
 */
export async function fetchLessonPlaylists(lessonSlug: string): Promise<PlaylistRef[]> {
  const body = await getCatalogJson<{ playlists: PlaylistRef[] }>(
    `/api/lessons/${encodeURIComponent(lessonSlug)}/playlists`,
  );
  return body?.playlists ?? [];
}
