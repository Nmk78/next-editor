import { describe, expect, it } from "vite-plus/test";
import type { Lesson, Playlist } from "../types";
import { coursePosition, courseShortcutFor, lessonHref, playlistHref } from "./courseNavigation";

const lesson = (slug: string): Lesson => ({
  slug,
  title: slug,
  description: "",
  thumbnail: "",
  ne: "",
});
const playlist: Playlist = {
  slug: "css-course",
  title: "CSS Course",
  description: "",
  lessons: [lesson("one"), lesson("two"), lesson("three")],
};

const key = (
  key: string,
  mods: Partial<Record<"shift" | "ctrl" | "meta" | "alt", boolean>> = {},
) => ({
  key,
  shiftKey: mods.shift ?? false,
  ctrlKey: mods.ctrl ?? false,
  metaKey: mods.meta ?? false,
  altKey: mods.alt ?? false,
});

describe("coursePosition", () => {
  it("places a lesson between its neighbours", () => {
    expect(coursePosition(playlist, "two")).toEqual({
      index: 1,
      total: 3,
      previous: playlist.lessons[0],
      next: playlist.lessons[2],
    });
  });

  it("has no previous lesson at the start and no next one at the end", () => {
    expect(coursePosition(playlist, "one")).toMatchObject({ index: 0, previous: undefined });
    expect(coursePosition(playlist, "three")).toMatchObject({ index: 2, next: undefined });
  });

  it("is null without a playlist or for a lesson the playlist does not hold", () => {
    expect(coursePosition(undefined, "two")).toBeNull();
    expect(coursePosition(null, "two")).toBeNull();
    expect(coursePosition(playlist, "elsewhere")).toBeNull();
  });
});

describe("lesson and playlist links", () => {
  it("keeps the playlist on a lesson's link when there is one", () => {
    expect(lessonHref("css-course-12")).toBe("/learn/css-course-12");
    expect(lessonHref("css-course-12", "css-course")).toBe("/learn/css-course-12?list=css-course");
  });

  it("links a playlist to its own page", () => {
    expect(playlistHref("css-course")).toBe("/learn/playlist/css-course");
  });

  it("escapes what a slug cannot hold as is", () => {
    expect(lessonHref("a b", "c&d")).toBe("/learn/a%20b?list=c%26d");
  });
});

describe("courseShortcutFor", () => {
  it("steps forward on Shift+N and back on Shift+P, whatever the case", () => {
    expect(courseShortcutFor(key("N", { shift: true }))).toBe(1);
    expect(courseShortcutFor(key("P", { shift: true }))).toBe(-1);
    // Caps Lock with Shift reports the lower case letter.
    expect(courseShortcutFor(key("n", { shift: true }))).toBe(1);
  });

  it("leaves the keys alone without Shift or with another modifier", () => {
    expect(courseShortcutFor(key("n"))).toBeNull();
    expect(courseShortcutFor(key("N", { shift: true, ctrl: true }))).toBeNull();
    expect(courseShortcutFor(key("N", { shift: true, meta: true }))).toBeNull();
    expect(courseShortcutFor(key("P", { shift: true, alt: true }))).toBeNull();
  });

  it("ignores every other key", () => {
    expect(courseShortcutFor(key("K", { shift: true }))).toBeNull();
    expect(courseShortcutFor(key(">", { shift: true }))).toBeNull();
  });
});
