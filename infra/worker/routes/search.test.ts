import { describe, expect, it } from "vite-plus/test";
import { openSqliteD1 } from "../../db/testing";
import { searchRoute } from "./search";

/**
 * GET /api/search over real SQLite at the production schema: 30 published
 * "CSS course" lessons (lesson 30 newest), one draft, a CSS playlist and an
 * author whose name matches.
 */
function createEnv() {
  const { db, sqlite } = openSqliteD1();
  sqlite.exec(`
    INSERT INTO users (id, google_sub, email, name, username, created_at)
      VALUES ('owner', 'google-owner', 'owner@example.com', 'CSS Teacher', 'teacher', 0);
    INSERT INTO playlists (id, slug, owner_id, title, created_at, updated_at)
      VALUES ('p-css', 'css-course', 'owner', 'CSS Course', 0, 0);
  `);
  const lesson = sqlite.prepare(
    `INSERT INTO lessons (id, slug, owner_id, title, ne, status, published_at, created_at, updated_at)
     VALUES (?, ?, 'owner', ?, 'x.ne', ?, ?, 0, 0)`,
  );
  const member = sqlite.prepare(
    "INSERT INTO playlist_lessons (playlist_id, lesson_id, position, added_at) VALUES ('p-css', ?, ?, 0)",
  );
  for (let n = 1; n <= 30; n++) {
    lesson.run(`l${n}`, `css-${n}`, `CSS course ${n}`, "published", n * 1000);
    member.run(`l${n}`, n - 1);
  }
  lesson.run("l-draft", "css-draft", "CSS course draft", "draft", null);
  return { DB: db } as never;
}

interface Body {
  authors: { username: string }[];
  playlists: { slug: string; lessonCount: number }[];
  lessons: { slug: string }[];
  nextPage: number | null;
}

async function get(env: never, query: string): Promise<{ status: number; body: Body }> {
  const res = await searchRoute.request(`https://nexteditor.dev/?${query}`, {}, env);
  return { status: res.status, body: (await res.json()) as Body };
}

describe("GET /api/search", () => {
  it("answers the first page of lessons, newest first, with the matching authors and playlists", async () => {
    const { status, body } = await get(createEnv(), "q=css");

    expect(status).toBe(200);
    expect(body.lessons).toHaveLength(24);
    expect(body.lessons[0].slug).toBe("css-30");
    expect(body.lessons.at(-1)?.slug).toBe("css-7");
    expect(body.nextPage).toBe(1);
    expect(body.authors.map((a) => a.username)).toEqual(["teacher"]);
    expect(body.playlists).toEqual([
      expect.objectContaining({ slug: "css-course", title: "CSS Course", lessonCount: 30 }),
    ]);
  });

  it("pages through every match, each once, leaving authors and playlists to page 0", async () => {
    const env = createEnv();
    const first = await get(env, "q=css");
    const second = await get(env, "q=css&page=1");

    expect(second.body.lessons.map((l) => l.slug)).toEqual([
      "css-6",
      "css-5",
      "css-4",
      "css-3",
      "css-2",
      "css-1",
    ]);
    expect(second.body.nextPage).toBeNull();
    expect(second.body.authors).toEqual([]);
    expect(second.body.playlists).toEqual([]);
    const slugs = [...first.body.lessons, ...second.body.lessons].map((l) => l.slug);
    // Every published match once; never the draft.
    expect(new Set(slugs).size).toBe(30);
    expect(slugs).not.toContain("css-draft");
  });

  it("answers an empty last page past the end", async () => {
    const { status, body } = await get(createEnv(), "q=css&page=5");

    expect(status).toBe(200);
    expect(body).toMatchObject({ lessons: [], nextPage: null });
  });

  it("refuses a page that is not a whole number from 0", async () => {
    for (const page of ["-1", "1.5", "two"]) {
      expect((await get(createEnv(), `q=css&page=${page}`)).status).toBe(400);
    }
  });

  it("answers nothing for an empty query", async () => {
    const { body } = await get(createEnv(), "q=%20%20");

    expect(body).toEqual({ authors: [], playlists: [], lessons: [], nextPage: null });
  });
});
