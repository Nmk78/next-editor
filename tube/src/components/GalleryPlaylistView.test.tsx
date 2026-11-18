import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Playlist } from "../types";

// The playlist lookup, as each test sets it.
const query = vi.hoisted(() => ({
  current: {} as { data?: Playlist | null; isPending: boolean; isError: boolean },
  refetch: vi.fn<() => void>(),
}));
vi.mock("../hooks/usePlaylists", () => ({
  usePlaylist: () => ({ ...query.current, refetch: query.refetch }),
}));
// Warming the lesson route would import the whole lesson player.
vi.mock("../hooks/useWarmLessonRoute", () => ({
  useWarmLessonRoute: () => {},
  useOnScreenThumbnailsSettled: () => new Promise<void>(() => {}),
}));
vi.mock("./LessonCard", () => ({
  default: ({
    lesson,
    listSlug,
  }: {
    lesson: { slug: string; title: string };
    listSlug?: string;
  }) => <a href={`/learn/${lesson.slug}?list=${listSlug}`}>{lesson.title}</a>,
}));

const { default: GalleryPlaylistView } = await import("./GalleryPlaylistView");

const lesson = (n: number) => ({
  slug: `css-${n}`,
  title: `CSS course ${n}`,
  description: "",
  thumbnail: "",
  ne: "",
});
const css: Playlist = {
  slug: "css-course",
  title: "CSS Course",
  description: "Learn CSS in order.",
  lessons: [1, 2, 3].map(lesson),
};

function renderView() {
  return render(
    <MemoryRouter>
      <h1>Lessons</h1>
      <GalleryPlaylistView slug="css-course" />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  query.refetch.mockClear();
});

describe("GalleryPlaylistView", () => {
  it("shows the playlist under the gallery's heading, its lessons in order, each in the playlist", () => {
    query.current = { data: css, isPending: false, isError: false };
    renderView();

    expect(screen.getByRole("heading", { level: 2, name: "CSS Course" })).toBeInTheDocument();
    expect(screen.getByText("Playlist · 3 lessons")).toBeInTheDocument();
    expect(screen.getByText("Learn CSS in order.")).toBeInTheDocument();
    const lessons = screen.getAllByRole("link", { name: /^CSS course/ });
    expect(lessons.map((a) => a.getAttribute("href"))).toEqual([
      "/learn/css-1?list=css-course",
      "/learn/css-2?list=css-course",
      "/learn/css-3?list=css-course",
    ]);
  });

  it("plays the playlist from its first lesson", () => {
    query.current = { data: css, isPending: false, isError: false };
    renderView();

    expect(screen.getByRole("link", { name: "Play all" })).toHaveAttribute(
      "href",
      "/learn/css-1?list=css-course",
    );
  });

  it("has nothing to play in an empty playlist", () => {
    query.current = { data: { ...css, lessons: [] }, isPending: false, isError: false };
    renderView();

    expect(screen.queryByRole("link", { name: "Play all" })).not.toBeInTheDocument();
    expect(screen.getByText("No lessons yet.")).toBeInTheDocument();
  });

  it("holds the playlist's place while it loads", () => {
    query.current = { data: undefined, isPending: true, isError: false };
    const { container } = renderView();

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
  });

  it("says when the playlist does not exist, with the way back to every lesson", () => {
    query.current = { data: null, isPending: false, isError: false };
    renderView();

    expect(screen.getByText("Playlist not found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all lessons" })).toHaveAttribute(
      "href",
      "/learn",
    );
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("offers a retry when the playlist failed to load", () => {
    query.current = { data: undefined, isPending: false, isError: true };
    renderView();

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Failed to load playlist.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(query.refetch).toHaveBeenCalledOnce();
  });
});
