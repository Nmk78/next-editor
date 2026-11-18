import { useEffect, useEffectEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import Breadcrumb from "@app/components/Breadcrumb";
import LangText from "@app/components/LangText";
import HoverRing from "@app/components/hoverRing/HoverRing";
import { isPlayerKeyTarget } from "@app/core/src/utils/playerKeyTargets";
import { isCharacterKey } from "@app/hooks/usePlayerShortcuts";
import { playbackSettingsStore } from "@app/stores/playbackSettingsStore";
import type { Lesson, Playlist } from "../types";
import {
  courseShortcutFor,
  lessonHref,
  playlistHref,
  type CoursePosition,
} from "../lib/courseNavigation";
import CourseContents from "./CourseContents";

// The steps give way on a phone, where the header has no room for them; the
// playlist contents (and Shift+N / Shift+P) still reach every lesson there.
const stepClass =
  "hidden size-7 items-center justify-center rounded-md text-slate-300 transition-colors sm:flex";

/**
 * The lesson page's header while a lesson is played through a playlist
 * (`?list=`): the trail with the playlist in it, the previous and next lessons,
 * where this lesson sits in the playlist, and, once it has played to its end
 * without continuing on its own, the next lesson to play. Shift+N and Shift+P
 * step through the playlist from the keyboard, under the same rules as the
 * player's own keys: not while typing, and not with single-key shortcuts off.
 */
export default function CourseNav({
  lesson,
  playlist,
  listSlug,
  position,
  ended,
  onPlayNext,
}: {
  lesson: Lesson;
  playlist: Playlist;
  listSlug: string;
  position: CoursePosition;
  /** This lesson played to its end and did not continue to the next by itself. */
  ended: boolean;
  /** Opens the next lesson and starts it playing. */
  onPlayNext: () => void;
}) {
  const navigate = useNavigate();
  const { previous, next } = position;

  // An Effect Event, so the listener below is added once, not on every lesson.
  const step = useEffectEvent((direction: -1 | 1): boolean => {
    const target = direction === 1 ? next : previous;
    if (!target) return false;
    navigate(lessonHref(target.slug, listSlug));
    return true;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const direction = courseShortcutFor(event);
      if (direction === null) return;
      // Read here, not from a hook, as the player does, so the setting applies at once.
      if (
        isCharacterKey(event.key) &&
        !playbackSettingsStore.getSnapshot().context.characterShortcuts
      )
        return;
      if (!isPlayerKeyTarget(event.target, event.key)) return;
      if (step(direction)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  let status = "";
  if (ended) {
    status = next
      ? `Lesson finished. Up next: ${next.title}`
      : "Lesson finished. That was the last lesson in this playlist.";
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* On the narrowest phones the trail is clipped rather than drawn under the
          controls beside it; the padding keeps its links' focus rings inside the clip. */}
      <div className="-m-1 flex min-w-0 overflow-hidden p-1">
        <Breadcrumb
          title={lesson.title}
          parent={{ title: playlist.title, to: playlistHref(listSlug) }}
        />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <StepLink lesson={previous} listSlug={listSlug} direction={-1} />
        <CourseContents playlist={playlist} listSlug={listSlug} currentIndex={position.index} />
        {ended && next ? (
          // On a phone just the icon, as there is no room for the title; the
          // label names the lesson either way.
          <button
            type="button"
            onClick={onPlayNext}
            aria-label={`Up next: ${next.title}`}
            className="ml-1 flex h-7 items-center gap-1.5 rounded-full bg-pinata-purple px-2 text-xs font-semibold text-white transition-colors hover:bg-[#5b46f0] sm:max-w-56 sm:px-3"
          >
            <SkipForward className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden truncate sm:block">
              Up next: <LangText text={next.title} />
            </span>
            <HoverRing />
          </button>
        ) : (
          <StepLink lesson={next} listSlug={listSlug} direction={1} />
        )}
      </div>
      {/* Stays mounted and only its text changes, so the change is announced. */}
      <span role="status" className="sr-only">
        <LangText text={status} />
      </span>
    </div>
  );
}

/** The previous or next lesson in the playlist; a disabled button at either end. */
function StepLink({
  lesson,
  listSlug,
  direction,
}: {
  lesson: Lesson | undefined;
  listSlug: string;
  direction: -1 | 1;
}) {
  const Icon = direction === 1 ? ChevronRight : ChevronLeft;
  const label = direction === 1 ? "Next lesson" : "Previous lesson";
  const keys = direction === 1 ? "Shift+N" : "Shift+P";

  if (!lesson) {
    return (
      <button
        type="button"
        disabled
        aria-label={label}
        title={direction === 1 ? "This is the last lesson" : "This is the first lesson"}
        className={`${stepClass} opacity-40`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <Link
      to={lessonHref(lesson.slug, listSlug)}
      aria-label={`${label}: ${lesson.title}`}
      aria-keyshortcuts={keys}
      title={`${label}: ${lesson.title} (${keys})`}
      className={`${stepClass} hover:text-white`}
    >
      <Icon className="size-4" aria-hidden="true" />
      <HoverRing />
    </Link>
  );
}
