import { describe, expect, it } from "vite-plus/test";
import { openSqliteD1 } from "../../db/testing";
import { lessonsRoute } from "./lessons";

/** GET /api/lessons/:slug/playlists over real SQLite at the production schema. */
function createEnv() {
  const { db, sqlite } = openSqliteD1();
  sqlite.exec(`
    INSERT INTO users (id, google_sub, email, username, created_at)
      VALUES ('owner', 'google-owner', 'owner@example.com', 'owner', 0);
    INSERT INTO lessons (id, slug, owner_id, title, ne, status, created_at, updated_at) VALUES
      ('l1', 'css-1', 'owner', 'CSS 1', 'l1.ne', 'published', 0, 0),
      ('l2', 'css-draft', 'owner', 'CSS draft', 'l2.ne', 'draft', 0, 0),
      ('l3', 'standalone', 'owner', 'On its own', 'l3.ne', 'published', 0, 0);
    INSERT INTO playlists (id, slug, owner_id, title, created_at, updated_at)
      VALUES ('p1', 'css-course', 'owner', 'CSS Course', 0, 0);
    INSERT INTO playlist_lessons (playlist_id, lesson_id, position, added_at) VALUES
      ('p1', 'l1', 0, 0), ('p1', 'l2', 1, 0);
  `);
  return { DB: db } as never;
}

async function playlistsOf(slug: string) {
  const res = await lessonsRoute.request(
    `https://nexteditor.dev/${slug}/playlists`,
    {},
    createEnv(),
  );
  return { status: res.status, body: await res.json() };
}

describe("GET /api/lessons/:slug/playlists", () => {
  it("names the public playlists a published lesson belongs to", async () => {
    await expect(playlistsOf("css-1")).resolves.toEqual({
      status: 200,
      body: { playlists: [{ slug: "css-course", title: "CSS Course" }] },
    });
  });

  it("names none for a lesson in no playlist, a draft, or an unknown slug", async () => {
    for (const slug of ["standalone", "css-draft", "nope"]) {
      await expect(playlistsOf(slug)).resolves.toEqual({ status: 200, body: { playlists: [] } });
    }
  });
});
