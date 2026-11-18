import { useState } from "react";
import { Link } from "react-router";
import { ListMusic, Play } from "lucide-react";
import LangText from "@app/components/LangText";
import HoverRing from "@app/components/hoverRing/HoverRing";
import type { Playlist } from "../types";
import { useOnScreenThumbnailsSettled, useWarmLessonRoute } from "../hooks/useWarmLessonRoute";
import { lessonHref } from "../lib/courseNavigation";
import LessonCard from "./LessonCard";

/**
 * A playlist as a viewer follows it: its name and description, "Play all" from
 * the first lesson, and its lessons in the playlist's own order. Every lesson
 * opens inside the playlist (`?list=`), so its page offers the lessons around
 * it. Shared by the playlist's own page and the gallery's playlist view, which
 * differ only in where the title sits in the page's headings.
 */
export default function PlaylistLessons({
  playlist,
  titleAs: Title = "h1",
}: {
  playlist: Playlist;
  /** h1 on the playlist's own page; h2 inside the gallery, under its "Lessons" h1. */
  titleAs?: "h1" | "h2";
}) {
  const count = playlist.lessons.length;
  const [first] = playlist.lessons;
  // Each card opens the lesson route, which these pages do not load up front;
  // fetch it once the cards on screen have their thumbnails.
  const [cards, setCards] = useState<HTMLDivElement | null>(null);
  useWarmLessonRoute(useOnScreenThumbnailsSettled(cards));

  return (
    <>
      <div className="py-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-slate-300">
          <ListMusic className="size-3.5" />
          Playlist · {count} {count === 1 ? "lesson" : "lessons"}
        </p>
        <Title className="mt-1.5 text-2xl font-semibold text-white">
          <LangText text={playlist.title} />
        </Title>
        {playlist.description && (
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            <LangText text={playlist.description} />
          </p>
        )}
        {first && (
          <Link
            to={lessonHref(first.slug, playlist.slug)}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-slate-200"
          >
            <Play className="size-4" aria-hidden="true" />
            Play all
            <HoverRing />
          </Link>
        )}
      </div>

      {count === 0 ? (
        <div className="flex justify-center py-20 text-slate-300">No lessons yet.</div>
      ) : (
        <div
          ref={setCards}
          className="grid grid-cols-1 gap-5 pb-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {playlist.lessons.map((lesson) => (
            <LessonCard key={lesson.slug} lesson={lesson} listSlug={playlist.slug} />
          ))}
        </div>
      )}
    </>
  );
}
