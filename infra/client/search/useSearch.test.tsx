import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { lessonKeys } from "../../lessons/queryKeys";
import type { Lesson } from "../../lessons/types";
import type { PlaylistSummary } from "../../db/types";
import type { SearchPage } from "./searchApi";

const search = vi.hoisted(() => vi.fn<(q: string, page: number) => Promise<SearchPage>>());

vi.mock("./searchApi", () => ({ search: (q: string, page = 0) => search(q, page) }));

const { useSearch } = await import("./useSearch");

function lesson(slug: string): Lesson {
  return {
    slug,
    title: slug,
    description: "",
    thumbnail: `lessons/${slug}/thumb.webp`,
    ne: `lessons/${slug}/lesson.ne`,
  };
}

const playlist: PlaylistSummary = {
  slug: "css-course",
  title: "CSS Course",
  description: "",
  lessonCount: 43,
  thumbnail: null,
};

function renderSearch(initialQ: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = renderHook(({ q }) => useSearch(q), {
    initialProps: { q: initialQ },
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  return { ...view, queryClient };
}

describe("useSearch", () => {
  // A lesson opened from the results should resolve from cache instead of a
  // second request for the row the search already returned.
  it("seeds each result's lesson detail query", async () => {
    search.mockResolvedValue({
      authors: [],
      playlists: [playlist],
      lessons: [lesson("ownership"), lesson("borrowing")],
      nextPage: null,
    });

    const { result, queryClient } = renderSearch("rust");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({
      authors: [],
      playlists: [playlist],
      lessons: [lesson("ownership"), lesson("borrowing")],
    });
    expect(search).toHaveBeenCalledWith("rust", 0);
    expect(queryClient.getQueryData(lessonKeys.detail("ownership"))).toEqual(lesson("ownership"));
    expect(queryClient.getQueryData(lessonKeys.detail("borrowing"))).toEqual(lesson("borrowing"));
  });

  // A newer search must not blank the page while it loads.
  it("keeps the last search's results as placeholder data while the next one loads", async () => {
    search
      .mockResolvedValueOnce({ authors: [], lessons: [lesson("ownership")] })
      .mockImplementationOnce(() => new Promise(() => {}));

    const { result, rerender } = renderSearch("rust");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ q: "go" });
    await waitFor(() => expect(search).toHaveBeenCalledWith("go", 0));
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.isPending).toBe(false);
    expect(result.current.data?.lessons).toEqual([lesson("ownership")]);
  });

  it("loads further pages of lessons on request, each lesson once", async () => {
    search.mockImplementation(async (_q, page) =>
      page === 0
        ? { authors: [], playlists: [playlist], lessons: [lesson("a"), lesson("b")], nextPage: 1 }
        : // A lesson published between the two requests shifts "b" onto page 1 too.
          { authors: [], playlists: [], lessons: [lesson("b"), lesson("c")], nextPage: null },
    );

    const { result, queryClient } = renderSearch("css");
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());

    expect(search).toHaveBeenLastCalledWith("css", 1);
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    // Playlists (and authors) come from the first page; lessons from every page.
    expect(result.current.data).toEqual({
      authors: [],
      playlists: [playlist],
      lessons: [lesson("a"), lesson("b"), lesson("c")],
    });
    expect(queryClient.getQueryData(lessonKeys.detail("c"))).toEqual(lesson("c"));
  });

  it("reads an answer without playlists or paging as one page with no playlists", async () => {
    search.mockResolvedValue({ authors: [], lessons: [lesson("ownership")] });

    const { result } = renderSearch("rust");
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.playlists).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });
});
