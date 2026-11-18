import type { Lesson, Playlist } from "../types";

/** Where a lesson sits in the playlist it is being played through. */
export interface CoursePosition {
  /** The lesson's 0-based index in the playlist. */
  index: number;
  /** How many lessons the playlist has. */
  total: number;
  /** The lesson before this one, or undefined at the start of the playlist. */
  previous: Lesson | undefined;
  /** The lesson after this one, or undefined at the end of the playlist. */
  next: Lesson | undefined;
}

/**
 * The lesson's place in `playlist`, or null when there is no playlist or the
 * lesson is not in it. A stale or foreign `?list=` therefore means no playlist
 * context at all, not a wrong one.
 */
export function coursePosition(
  playlist: Playlist | null | undefined,
  lessonSlug: string,
): CoursePosition | null {
  if (!playlist) return null;
  const index = playlist.lessons.findIndex((lesson) => lesson.slug === lessonSlug);
  if (index === -1) return null;
  return {
    index,
    total: playlist.lessons.length,
    previous: playlist.lessons[index - 1],
    next: playlist.lessons[index + 1],
  };
}

/**
 * A lesson page's address. With `listSlug`, the page is played through that
 * playlist (`?list=`): it knows the lessons around it and can continue to the
 * next one.
 */
export function lessonHref(lessonSlug: string, listSlug?: string): string {
  const path = `/learn/${encodeURIComponent(lessonSlug)}`;
  return listSlug ? `${path}?list=${encodeURIComponent(listSlug)}` : path;
}

type KeyPress = Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey">;

/**
 * The playlist step a key asks for: Shift+N the next lesson, Shift+P the
 * previous one, as in web video players. Null for any other key. The player's
 * own shortcuts leave N and P alone, so the two never compete for a key.
 */
export function courseShortcutFor(event: KeyPress): -1 | 1 | null {
  if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return null;
  switch (event.key.toUpperCase()) {
    case "N":
      return 1;
    case "P":
      return -1;
    default:
      return null;
  }
}

/** A playlist's own page, the parent of its lessons. */
export function playlistHref(listSlug: string): string {
  return `/learn/playlist/${encodeURIComponent(listSlug)}`;
}
