// @vitest-environment node
import { describe, expect, it, vi } from "vite-plus/test";
import {
  addLessonToPlaylist,
  addLessonsToPlaylist,
  deletePlaylist,
  getOwnedPlaylistLessons,
  getPlaylistBySlug,
  insertPlaylist,
  removeLessonFromPlaylist,
  reorderPlaylistLessons,
  listPublishedPlaylists,
  searchPublishedPlaylists,
} from "./playlistQueries";
import { MAX_PLAYLISTS_PER_OWNER } from "./ownerLimits";
import { openSqliteD1 } from "./testing";

/**
 * The playlist queries against real SQLite at the production schema, so the
 * ownership checks, each mutation's outcome and the public read's membership
 * come from the SQL itself.
 */
function createDb(): D1Database {
  const { db, sqlite } = openSqliteD1();
  sqlite.exec(`
    INSERT INTO users (id, google_sub, email, username, created_at)
      VALUES ('owner', 'google-owner', 'owner@example.com', 'owner', 0);
    INSERT INTO lessons (id, slug, owner_id, title, ne, status, created_at, updated_at) VALUES
      ('lesson-1', 'lesson-one', 'owner', 'Lesson one', 'media/lessons/lesson-1/lesson-1.ne', 'published', 0, 0),
      ('lesson-2', 'lesson-two', 'owner', 'Lesson two', 'media/lessons/lesson-2/lesson-2.ne', 'published', 0, 0);
    INSERT INTO playlists (id, slug, owner_id, title, created_at, updated_at)
      VALUES ('playlist-1', 'my-list', 'owner', 'My list', 0, 0);
  `);
  return db;
}

describe("playlist mutations", () => {
  it("succeed for the owner", async () => {
    const db = createDb();

    await expect(addLessonToPlaylist(db, "playlist-1", "owner", "lesson-1")).resolves.toEqual({
      status: "ok",
    });
    await addLessonToPlaylist(db, "playlist-1", "owner", "lesson-2");
    await expect(
      reorderPlaylistLessons(db, "playlist-1", "owner", ["lesson-2", "lesson-1"]),
    ).resolves.toBe(true);
    await expect(removeLessonFromPlaylist(db, "playlist-1", "owner", "lesson-1")).resolves.toBe(
      true,
    );
    await expect(deletePlaylist(db, "playlist-1", "owner")).resolves.toBe(true);
  });

  it("fail for anyone else, or a no-op", async () => {
    const db = createDb();

    await expect(addLessonToPlaylist(db, "playlist-1", "intruder", "lesson-1")).resolves.toEqual({
      status: "not_found",
    });
    await expect(reorderPlaylistLessons(db, "playlist-1", "intruder", [])).resolves.toBe(false);
    await expect(removeLessonFromPlaylist(db, "playlist-1", "owner", "lesson-1")).resolves.toBe(
      false,
    );
    await expect(deletePlaylist(db, "playlist-1", "intruder")).resolves.toBe(false);
    await expect(deletePlaylist(db, "playlist-1", "owner")).resolves.toBe(true);
  });

  it("answer a second add of the same lesson with already_added", async () => {
    const db = createDb();
    await addLessonToPlaylist(db, "playlist-1", "owner", "lesson-1");

    await expect(addLessonToPlaylist(db, "playlist-1", "owner", "lesson-1")).resolves.toEqual({
      status: "already_added",
    });
  });
});

describe("addLessonsToPlaylist", () => {
  /** createDb plus a third published lesson, a draft, and someone else's lesson. */
  function courseDb() {
    const { db, sqlite } = openSqliteD1();
    sqlite.exec(`
      INSERT INTO users (id, google_sub, email, username, created_at) VALUES
        ('owner', 'google-owner', 'owner@example.com', 'owner', 0),
        ('other', 'google-other', 'other@example.com', 'other', 0);
      INSERT INTO lessons (id, slug, owner_id, title, ne, status, created_at, updated_at) VALUES
        ('lesson-1', 'lesson-one', 'owner', 'Lesson one', 'media/lessons/lesson-1/lesson-1.ne', 'published', 0, 0),
        ('lesson-2', 'lesson-two', 'owner', 'Lesson two', 'media/lessons/lesson-2/lesson-2.ne', 'published', 0, 0),
        ('lesson-3', 'lesson-three', 'owner', 'Lesson three', 'media/lessons/lesson-3/lesson-3.ne', 'published', 0, 0),
        ('draft-1', 'draft-one', 'owner', 'Draft one', 'media/lessons/draft-1/draft-1.ne', 'draft', 0, 0),
        ('theirs', 'theirs', 'other', 'Theirs', 'media/lessons/theirs/theirs.ne', 'published', 0, 0);
      INSERT INTO playlists (id, slug, owner_id, title, created_at, updated_at)
        VALUES ('playlist-1', 'my-list', 'owner', 'My list', 0, 0);
    `);
    return db;
  }
  const memberIds = async (db: D1Database) =>
    (await getOwnedPlaylistLessons(db, "playlist-1", "owner"))?.map((row) => row.id);

  it("appends the owner's published lessons in the given order, after the members", async () => {
    const db = courseDb();
    await addLessonToPlaylist(db, "playlist-1", "owner", "lesson-2");

    await expect(
      addLessonsToPlaylist(db, "playlist-1", "owner", [
        "lesson-3",
        "lesson-2",
        "draft-1",
        "theirs",
        "lesson-1",
        "lesson-3",
      ]),
    ).resolves.toEqual({
      status: "ok",
      added: ["lesson-3", "lesson-1"],
      alreadyAdded: ["lesson-2"],
      notEligible: ["draft-1", "theirs"],
    });
    await expect(memberIds(db)).resolves.toEqual(["lesson-2", "lesson-3", "lesson-1"]);
  });

  it("answers not_found for someone else's playlist, and adds nothing", async () => {
    const db = courseDb();

    await expect(addLessonsToPlaylist(db, "playlist-1", "other", ["theirs"])).resolves.toEqual({
      status: "not_found",
    });
    await expect(memberIds(db)).resolves.toEqual([]);
  });

  it("checks more ids than one statement can bind", async () => {
    const db = courseDb();
    const unknown = Array.from({ length: 150 }, (_, index) => `missing-${index}`);

    const result = await addLessonsToPlaylist(db, "playlist-1", "owner", [...unknown, "lesson-1"]);

    expect(result).toMatchObject({ status: "ok", added: ["lesson-1"] });
    expect(result.status === "ok" && result.notEligible).toHaveLength(150);
  });
});

describe("getPlaylistBySlug", () => {
  it("answers the playlist and its published members in position order, in one batch", async () => {
    const db = createDb();
    await addLessonToPlaylist(db, "playlist-1", "owner", "lesson-1");
    await addLessonToPlaylist(db, "playlist-1", "owner", "lesson-2");
    await reorderPlaylistLessons(db, "playlist-1", "owner", ["lesson-2", "lesson-1"]);
    const batch = vi.spyOn(db, "batch");

    const result = await getPlaylistBySlug(db, "my-list");

    expect(result?.playlist).toMatchObject({ id: "playlist-1", slug: "my-list" });
    expect(result?.lessons.map((lesson) => lesson.id)).toEqual(["lesson-2", "lesson-1"]);
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it("leaves out a member that is no longer published", async () => {
    const db = createDb();
    await addLessonToPlaylist(db, "playlist-1", "owner", "lesson-1");
    await addLessonToPlaylist(db, "playlist-1", "owner", "lesson-2");
    await db.prepare("UPDATE lessons SET status = 'draft' WHERE id = ?").bind("lesson-1").run();

    const result = await getPlaylistBySlug(db, "my-list");

    expect(result?.lessons.map((lesson) => lesson.id)).toEqual(["lesson-2"]);
  });

  it("answers an empty playlist with no members", async () => {
    const result = await getPlaylistBySlug(createDb(), "my-list");

    expect(result).toMatchObject({ playlist: { slug: "my-list" }, lessons: [] });
  });

  it("answers null for an unknown slug", async () => {
    await expect(getPlaylistBySlug(createDb(), "nope")).resolves.toBeNull();
  });
});

describe("insertPlaylist", () => {
  it("refuses a playlist past MAX_PLAYLISTS_PER_OWNER, inside the INSERT", async () => {
    const { db, sqlite } = openSqliteD1();
    sqlite.exec(`
      INSERT INTO users (id, google_sub, email, username, created_at) VALUES
        ('owner', 'google-owner', 'owner@example.com', 'owner', 0),
        ('other', 'google-other', 'other@example.com', 'other', 0);
    `);
    const insert = sqlite.prepare(
      "INSERT INTO playlists (id, slug, owner_id, title, created_at, updated_at) VALUES (?, ?, 'owner', 'Flood', 0, 0)",
    );
    for (let index = 0; index < MAX_PLAYLISTS_PER_OWNER - 1; index++) {
      insert.run(`seed-${index}`, `seed-${index}`);
    }
    const params = (id: string, ownerId = "owner") => ({
      id,
      slug: `slug-${id}`,
      ownerId,
      title: "Flood",
      description: "က".repeat(10_000),
    });

    expect(await insertPlaylist(db, params("last"))).toMatchObject({ id: "last" });
    expect(await insertPlaylist(db, params("one-too-many"))).toBeNull();
    expect(
      sqlite.prepare("SELECT COUNT(*) AS n FROM playlists WHERE owner_id = 'owner'").get(),
    ).toEqual({ n: MAX_PLAYLISTS_PER_OWNER });
    expect(await insertPlaylist(db, params("elsewhere", "other"))).toMatchObject({
      owner_id: "other",
    });
  });
});

/** Four playlists: a CSS course with a draft member, one all-draft, one empty, and a Go course. */
function createPublicDb(): D1Database {
  const { db, sqlite } = openSqliteD1();
  sqlite.exec(`
    INSERT INTO users (id, google_sub, email, username, created_at)
      VALUES ('owner', 'google-owner', 'owner@example.com', 'owner', 0);
    INSERT INTO lessons (id, slug, owner_id, title, ne, thumbnail, status, created_at, updated_at) VALUES
      ('l1', 'css-1', 'owner', 'CSS 1', 'l1.ne', 'thumbs/css-1.webp', 'published', 0, 0),
      ('l2', 'css-2', 'owner', 'CSS 2', 'l2.ne', 'thumbs/css-2.webp', 'published', 0, 0),
      ('l3', 'css-3', 'owner', 'CSS 3', 'l3.ne', 'thumbs/css-3.webp', 'draft', 0, 0);
    INSERT INTO playlists (id, slug, owner_id, title, description, created_at, updated_at) VALUES
      ('p-course', 'css-course', 'owner', 'CSS Course', 'Learn CSS in order', 0, 3),
      ('p-drafts', 'css-drafts', 'owner', 'CSS drafts', NULL, 0, 2),
      ('p-empty', 'css-empty', 'owner', 'Empty CSS list', NULL, 0, 1),
      ('p-go', 'go-course', 'owner', 'Go Course', 'Not about styling', 0, 4);
    INSERT INTO playlist_lessons (playlist_id, lesson_id, position, added_at) VALUES
      ('p-course', 'l2', 0, 0), ('p-course', 'l1', 1, 0), ('p-course', 'l3', 2, 0),
      ('p-drafts', 'l3', 0, 0),
      ('p-go', 'l1', 0, 0);
  `);
  return db;
}

describe("searchPublishedPlaylists", () => {
  it("finds public playlists by title or description, counting published members only", async () => {
    const rows = await searchPublishedPlaylists(createPublicDb(), "css", 10);

    expect(rows.map((row) => row.slug)).toEqual(["css-course"]);
    expect(rows[0]).toMatchObject({
      title: "CSS Course",
      lesson_count: 2,
      // The cover is the first published member in playlist order.
      first_lesson_thumbnail: "thumbs/css-2.webp",
    });
    await expect(searchPublishedPlaylists(createPublicDb(), "in order", 10)).resolves.toEqual([
      expect.objectContaining({ slug: "css-course" }),
    ]);
  });

  it("leaves out a playlist with no published lesson, empty or all-draft", async () => {
    const slugs = (await searchPublishedPlaylists(createPublicDb(), "CSS", 10)).map((r) => r.slug);

    expect(slugs).not.toContain("css-drafts");
    expect(slugs).not.toContain("css-empty");
  });

  it("matches LIKE wildcards literally and stops at the limit", async () => {
    const db = createPublicDb();

    await expect(searchPublishedPlaylists(db, "%", 10)).resolves.toEqual([]);
    await expect(searchPublishedPlaylists(db, "course", 1)).resolves.toEqual([
      // Most recently updated first.
      expect.objectContaining({ slug: "go-course" }),
    ]);
  });
});

describe("listPublishedPlaylists", () => {
  it("lists the public playlists, most recently updated first, counting published members only", async () => {
    const rows = await listPublishedPlaylists(createPublicDb(), 10);

    expect(rows.map((row) => [row.slug, row.lesson_count])).toEqual([
      ["go-course", 1],
      ["css-course", 2],
    ]);
  });

  it("stops at the limit", async () => {
    const rows = await listPublishedPlaylists(createPublicDb(), 1);

    expect(rows.map((row) => row.slug)).toEqual(["go-course"]);
  });
});
