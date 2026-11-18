import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { playbackSettingsStore } from "@app/stores/playbackSettingsStore";
import type { Lesson, Playlist } from "../types";
import { coursePosition } from "../lib/courseNavigation";
import CourseNav from "./CourseNav";

const lesson = (n: number): Lesson => ({
  slug: `css-${n}`,
  title: `CSS course ${n}`,
  description: "",
  thumbnail: "",
  ne: "",
  duration: `${n}:00`,
});
const playlist: Playlist = {
  slug: "css-course",
  title: "CSS Course",
  description: "",
  lessons: [1, 2, 3, 4].map(lesson),
};

// The lesson page as the router shows it, with where the router is now.
function LessonPage({ ended, onPlayNext }: { ended: boolean; onPlayNext: () => void }) {
  const { slug = "" } = useParams();
  const location = useLocation();
  const position = coursePosition(playlist, slug)!;
  return (
    <>
      <CourseNav
        lesson={playlist.lessons[position.index]}
        playlist={playlist}
        listSlug="css-course"
        position={position}
        ended={ended}
        onPlayNext={onPlayNext}
      />
      <input aria-label="A field" />
      <p data-testid="location">{location.pathname + location.search}</p>
    </>
  );
}

function renderAt(slug: string, { ended = false, onPlayNext = vi.fn<() => void>() } = {}) {
  render(
    <MemoryRouter initialEntries={[`/learn/${slug}?list=css-course`]}>
      <Routes>
        <Route path="/learn/:slug" element={<LessonPage ended={ended} onPlayNext={onPlayNext} />} />
        <Route path="/learn/playlist/:slug" element={<p>playlist page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onPlayNext };
}

const location = () => screen.getByTestId("location").textContent;

afterEach(() => {
  playbackSettingsStore.trigger.setCharacterShortcuts({ enabled: true });
});

describe("CourseNav", () => {
  it("puts the playlist in the trail between the gallery and the lesson", () => {
    renderAt("css-2");

    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Lessons" })).toHaveAttribute("href", "/learn");
    expect(within(trail).getByRole("link", { name: "CSS Course" })).toHaveAttribute(
      "href",
      "/learn/playlist/css-course",
    );
    expect(within(trail).getByText("CSS course 2")).toBeInTheDocument();
  });

  it("links the lessons on either side, staying in the playlist", () => {
    renderAt("css-2");

    expect(screen.getByRole("link", { name: "Previous lesson: CSS course 1" })).toHaveAttribute(
      "href",
      "/learn/css-1?list=css-course",
    );
    expect(screen.getByRole("link", { name: "Next lesson: CSS course 3" })).toHaveAttribute(
      "href",
      "/learn/css-3?list=css-course",
    );
  });

  it("disables the step past either end of the playlist", () => {
    renderAt("css-1");
    expect(screen.getByRole("button", { name: "Previous lesson" })).toBeDisabled();
  });

  it("disables next on the last lesson", () => {
    renderAt("css-4");
    expect(screen.getByRole("button", { name: "Next lesson" })).toBeDisabled();
  });

  it("lists the playlist in order, marking this lesson, and opens another", async () => {
    const user = userEvent.setup();
    renderAt("css-2");

    const toggle = screen.getByRole("button", { name: "Playlist contents, lesson 2 of 4" });
    expect(toggle).toHaveTextContent("2 / 4");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("group", { name: "CSS Course" });
    const items = within(panel).getAllByRole("link");
    expect(items.map((item) => item.textContent)).toEqual([
      "1CSS course 11:00",
      "2CSS course 22:00",
      "3CSS course 33:00",
      "4CSS course 44:00",
    ]);
    expect(items[1]).toHaveAttribute("aria-current", "page");

    await user.click(items[3]);
    expect(location()).toBe("/learn/css-4?list=css-course");
    expect(screen.queryByRole("group", { name: "CSS Course" })).not.toBeInTheDocument();
  });

  it("closes the contents on Escape, back on its button, and on a press outside", async () => {
    const user = userEvent.setup();
    renderAt("css-2");
    const toggle = screen.getByRole("button", { name: /Playlist contents/ });

    await user.click(toggle);
    await user.tab();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "CSS Course" })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();

    await user.click(toggle);
    await user.click(screen.getByRole("textbox", { name: "A field" }));
    expect(screen.queryByRole("group", { name: "CSS Course" })).not.toBeInTheDocument();
  });

  it("steps through the playlist with Shift+N and Shift+P", async () => {
    const user = userEvent.setup();
    renderAt("css-2");

    await user.keyboard("{Shift>}N{/Shift}");
    expect(location()).toBe("/learn/css-3?list=css-course");
    await user.keyboard("{Shift>}P{/Shift}");
    await user.keyboard("{Shift>}P{/Shift}");
    expect(location()).toBe("/learn/css-1?list=css-course");
    // Nothing before the first lesson.
    await user.keyboard("{Shift>}P{/Shift}");
    expect(location()).toBe("/learn/css-1?list=css-course");
  });

  it("leaves Shift+N to a field being typed in", async () => {
    const user = userEvent.setup();
    renderAt("css-2");

    await user.click(screen.getByRole("textbox", { name: "A field" }));
    await user.keyboard("{Shift>}N{/Shift}");
    expect(location()).toBe("/learn/css-2?list=css-course");
    expect(screen.getByRole("textbox", { name: "A field" })).toHaveValue("N");
  });

  it("follows the player's single-key shortcuts setting", async () => {
    const user = userEvent.setup();
    playbackSettingsStore.trigger.setCharacterShortcuts({ enabled: false });
    renderAt("css-2");

    await user.keyboard("{Shift>}N{/Shift}");
    expect(location()).toBe("/learn/css-2?list=css-course");
  });

  it("offers the next lesson once this one has played to its end", async () => {
    const user = userEvent.setup();
    const { onPlayNext } = renderAt("css-2", { ended: true });

    expect(screen.getByRole("status")).toHaveTextContent("Lesson finished. Up next: CSS course 3");
    expect(screen.queryByRole("link", { name: /Next lesson/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Up next: CSS course 3" }));
    expect(onPlayNext).toHaveBeenCalledOnce();
  });

  it("says the playlist is over when its last lesson ends", () => {
    renderAt("css-4", { ended: true });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Lesson finished. That was the last lesson in this playlist.",
    );
    expect(screen.queryByRole("button", { name: /Up next/ })).not.toBeInTheDocument();
  });

  it("announces nothing while the lesson plays", () => {
    renderAt("css-2");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
