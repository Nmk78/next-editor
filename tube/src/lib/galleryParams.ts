// The gallery's state in its URL, so Back, a reload or a shared link brings it
// back: a search (/learn?q=…) or one playlist (/learn?playlist=…). At most one
// of the two is set; choosing either clears the other.

/** The submitted search: /learn?q=css+course. */
export const SEARCH_PARAM = "q";

/** The playlist the gallery shows instead of every lesson: /learn?playlist=css-course. */
export const PLAYLIST_PARAM = "playlist";

/** The gallery showing one playlist. */
export function galleryPlaylistHref(listSlug: string): string {
  return `/learn?${PLAYLIST_PARAM}=${encodeURIComponent(listSlug)}`;
}
