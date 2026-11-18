import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { primeLessonDetails, searchKeys } from "../../lessons/queryKeys";
import { search, type SearchPage, type SearchResults } from "./searchApi";

/**
 * What the pages loaded so far show: the first page's authors and playlists,
 * and every page's lessons, each slug once (a lesson published between two
 * page requests shifts the rest down a row, so a boundary row can repeat).
 */
export function searchResultsFrom(data: InfiniteData<SearchPage, number>): SearchResults {
  const [first] = data.pages;
  const seen = new Set<string>();
  const lessons: SearchResults["lessons"] = [];
  for (const page of data.pages) {
    for (const lesson of page.lessons) {
      if (seen.has(lesson.slug)) continue;
      seen.add(lesson.slug);
      lessons.push(lesson);
    }
  }
  return { authors: first?.authors ?? [], playlists: first?.playlists ?? [], lessons };
}

// Searches every published lesson, playlist and author, not just what the
// gallery has paged in. `q` is a query the reader submitted, not each
// keystroke. Lessons come a page at a time: fetchNextPage loads more while
// hasNextPage says there are.
export function useSearch(q: string) {
  const queryClient = useQueryClient();

  return useInfiniteQuery({
    queryKey: searchKeys.query(q),
    queryFn: async ({ pageParam }) => {
      const page = await search(q, pageParam);
      // Each result is the same whole lesson /api/lessons/:slug returns, so
      // opening one resolves from cache.
      primeLessonDetails(queryClient, page.lessons);
      return page;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    select: searchResultsFrom,
    enabled: q.length > 0,
    staleTime: 30_000,
    // While the next search loads, the last one's results stay (isPlaceholderData),
    // so the page dims them instead of blanking.
    placeholderData: keepPreviousData,
  });
}
