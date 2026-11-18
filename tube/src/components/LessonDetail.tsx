import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import Editor from "@app/components/Editor";
import { playbackSettingsStore } from "@app/stores/playbackSettingsStore";
import type { Lesson } from "../types";
import { useLessonPlaylists, usePlaylist } from "../hooks/usePlaylists";
import { coursePosition, lessonHref } from "../lib/courseNavigation";
import Breadcrumb from "@app/components/Breadcrumb";
import { useEmbedded } from "@app/utils/embed";
import CourseNav from "./CourseNav";

interface LessonDetailLocationState {
  /** Set by the "Continue to Next" auto-advance navigation (and by choosing
   *  "Up next" once a lesson ends) so the next lesson always starts playing,
   *  regardless of the persisted Autoplay setting. */
  autoplay?: boolean;
}

export default function LessonDetail({ lesson }: { lesson: Lesson }) {
  const [searchParams] = useSearchParams();
  const listParam = searchParams.get("list") ?? undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const embedded = useEmbedded();
  // Opened without `?list=` (from the gallery, search or a shared link), the
  // lesson is played through its playlist when it belongs to exactly one;
  // with none, or several to choose between, it is played on its own as
  // before. An embed never looks: it plays only what the embedding page chose.
  const { data: ownPlaylists } = useLessonPlaylists(
    listParam || embedded ? undefined : lesson.slug,
  );
  const listSlug = listParam ?? (ownPlaylists?.length === 1 ? ownPlaylists[0].slug : undefined);
  const { data: playlist } = usePlaylist(listSlug);

  // A stale/foreign `?list=` (lesson isn't actually in the resolved playlist) is
  // treated as no playlist context at all.
  const position = coursePosition(playlist, lesson.slug);
  const playlistMode = position !== null;
  const nextLesson = position?.next;
  // The lesson that last played to its end without continuing by itself, so the
  // header offers the next one. Held by slug: on another lesson it no longer applies.
  const [endedSlug, setEndedSlug] = useState<string | null>(null);

  const playNext = () => {
    if (!nextLesson || !listSlug) return;
    navigate(lessonHref(nextLesson.slug, listSlug), {
      state: { autoplay: true } satisfies LessonDetailLocationState,
    });
  };

  const handleEnded = () => {
    if (!nextLesson || !listSlug) return;
    const { continueToNext } = playbackSettingsStore.getSnapshot().context;
    if (continueToNext) playNext();
    else setEndedSlug(lesson.slug);
  };

  // Only an in-app auto-advance navigation sets this. Router state isn't part of
  // the URL (direct deep links never force-play), but React Router persists it in
  // history.state.usr, which browsers restore across reloads and back/forward —
  // the effect below scrubs that persisted copy so the override is truly one-shot.
  const autoplayOverride = (location.state as LessonDetailLocationState | null)?.autoplay ?? false;

  // Scrub the flag from the history entry (bypassing the router: a router-level
  // replace-navigation would swap in a state-less location and flip
  // autoplayOverride back to false before the recording finishes loading, killing
  // the autoplay it exists to trigger). React Router's in-memory location keeps
  // the flag until the next navigation, so the Editor still sees it; only the
  // persisted copy that would survive refresh/back-forward is cleared. `key` and
  // `idx` in history.state are the router's own bookkeeping — preserved by the
  // spread.
  useEffect(() => {
    if (!autoplayOverride) return;
    window.history.replaceState({ ...window.history.state, usr: null }, "");
  }, [autoplayOverride, location.key]);

  // Played through a playlist, the header carries the playlist's navigation;
  // otherwise the plain trail back to the gallery. An embed has neither.
  const breadcrumb = embedded ? undefined : position && playlist && listSlug ? (
    <CourseNav
      lesson={lesson}
      playlist={playlist}
      listSlug={listSlug}
      position={position}
      ended={endedSlug === lesson.slug}
      onPlayNext={playNext}
    />
  ) : (
    <Breadcrumb title={lesson.title} />
  );

  return (
    <Editor
      readOnly
      recordingUrl={`/${lesson.ne}`}
      breadcrumb={breadcrumb}
      playlistMode={playlistMode}
      onEnded={handleEnded}
      autoplayOverride={autoplayOverride}
    />
  );
}
