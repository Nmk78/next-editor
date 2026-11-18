import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { playbackSettingsStore } from "@app/stores/playbackSettingsStore";
import type { Lesson, Playlist } from "../types";

interface EditorProps {
  breadcrumb?: ReactNode;
  playlistMode?: boolean;
  onEnded?: () => void;
  autoplayOverride?: boolean;
}

// The editor as far as the lesson page drives it: its header and the props it is given.
const editor = vi.hoisted(() => ({ props: {} as EditorProps }));
vi.mock("@app/components/Editor", () => ({
  default: (props: EditorProps) => {
    editor.props = props;
    return <header>{props.breadcrumb}</header>;
  },
}));
const playlistQuery = vi.hoisted(() => ({ data: undefined as Playlist | null | undefined }));
vi.mock("../hooks/usePlaylists", () => ({ usePlaylist: () => playlistQuery }));

const { default: LessonDetail } = await import("./LessonDetail");

const lesson = (n: number): Lesson => ({
  slug: `css-${n}`,
  title: `CSS course ${n}`,
  description: "",
  thumbnail: "",
  ne: `media/css-${n}.ne`,
});
const playlist: Playlist = {
  slug: "css-course",
  title: "CSS Course",
  description: "",
  lessons: [1, 2, 3].map(lesson),
};

function LessonRoute() {
  const { slug } = useParams();
  const location = useLocation();
  const current = playlist.lessons.find((l) => l.slug === slug) ?? lesson(99);
  return (
    <>
      <LessonDetail lesson={current} />
      <p data-testid="location">{location.pathname + location.search}</p>
    </>
  );
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/learn/:slug" element={<LessonRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId("location").textContent;
const endPlayback = () => act(() => editor.props.onEnded?.());

afterEach(() => {
  playlistQuery.data = undefined;
  playbackSettingsStore.trigger.setContinueToNext({ continueToNext: false });
});

describe("LessonDetail", () => {
  it("keeps the plain trail for a lesson opened outside a playlist", () => {
    renderAt("/learn/css-2");

    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(
      "LessonsCSS course 2",
    );
    expect(screen.queryByRole("link", { name: /Next lesson/ })).not.toBeInTheDocument();
    expect(editor.props.playlistMode).toBe(false);
  });

  it("shows the playlist's navigation for a lesson played through it", () => {
    playlistQuery.data = playlist;
    renderAt("/learn/css-2?list=css-course");

    expect(screen.getByRole("link", { name: "CSS Course" })).toHaveAttribute(
      "href",
      "/learn/playlist/css-course",
    );
    expect(screen.getByRole("link", { name: "Next lesson: CSS course 3" })).toBeInTheDocument();
    expect(editor.props.playlistMode).toBe(true);
  });

  it("treats a playlist that does not hold the lesson as no playlist", () => {
    playlistQuery.data = playlist;
    renderAt("/learn/css-99?list=css-course");

    expect(screen.queryByRole("link", { name: "CSS Course" })).not.toBeInTheDocument();
    expect(editor.props.playlistMode).toBe(false);
  });

  it("renders no header trail inside an embed", () => {
    playlistQuery.data = playlist;
    renderAt("/learn/css-2?list=css-course&embed=true");

    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  });

  it("still continues to the next lesson on its own when Continue to Next is on", () => {
    playlistQuery.data = playlist;
    playbackSettingsStore.trigger.setContinueToNext({ continueToNext: true });
    renderAt("/learn/css-2?list=css-course");

    endPlayback();
    expect(location()).toBe("/learn/css-3?list=css-course");
    expect(editor.props.autoplayOverride).toBe(true);
  });

  it("offers the next lesson when Continue to Next is off, and plays it when chosen", async () => {
    const user = userEvent.setup();
    playlistQuery.data = playlist;
    renderAt("/learn/css-2?list=css-course");

    endPlayback();
    expect(location()).toBe("/learn/css-2?list=css-course");
    await user.click(screen.getByRole("button", { name: "Up next: CSS course 3" }));
    expect(location()).toBe("/learn/css-3?list=css-course");
    expect(editor.props.autoplayOverride).toBe(true);
    // The offer belonged to the lesson that ended, not to this one.
    expect(screen.queryByRole("button", { name: /Up next/ })).not.toBeInTheDocument();
  });

  it("does nothing at the end of a lesson outside a playlist", () => {
    renderAt("/learn/css-2");

    endPlayback();
    expect(location()).toBe("/learn/css-2");
    expect(screen.queryByRole("button", { name: /Up next/ })).not.toBeInTheDocument();
  });
});
