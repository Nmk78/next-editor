import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { ListOrdered } from "lucide-react";
import LangText from "@app/components/LangText";
import HoverRing from "@app/components/hoverRing/HoverRing";
import type { Playlist } from "../types";
import { lessonHref } from "../lib/courseNavigation";

/**
 * The playlist's lessons in order, opened from the lesson page's header by a
 * button that says where this lesson sits ("12 / 43"). A disclosure, not a
 * menu, like the player's chapters: a labelled group of links that Tab moves
 * through. Escape closes it and returns focus to the button; so does choosing
 * a lesson, and a press outside closes it too.
 */
export default function CourseContents({
  playlist,
  listSlug,
  currentIndex,
}: {
  playlist: Playlist;
  /** The playlist's slug, kept on every link so the next page stays in it. */
  listSlug: string;
  /** This lesson's 0-based index in the playlist. */
  currentIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const headingId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);
  const total = playlist.lessons.length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // A long course opens at this lesson, not at the top. The list scrolls itself
  // rather than calling scrollIntoView, which would also scroll the page.
  useEffect(() => {
    const list = listRef.current;
    const current = currentRef.current;
    if (!open || !list || !current) return;
    list.scrollTop = current.offsetTop - (list.clientHeight - current.offsetHeight) / 2;
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Playlist contents, lesson ${currentIndex + 1} of ${total}`}
        title="Playlist contents"
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold tabular-nums text-slate-300 transition-colors hover:text-white"
      >
        <ListOrdered className="size-3.5" aria-hidden="true" />
        {/* The count needs room a phone's header does not have; the label says it either way. */}
        <span className="hidden sm:inline">
          {currentIndex + 1} / {total}
        </span>
        <HoverRing />
      </button>

      {open && (
        // Under the button from `sm` up; on a phone, where the button sits mid-header,
        // across the screen below the header instead. z-[120] keeps it above the
        // player's floating play button (z-index 110), which sits mid-screen.
        <div
          id={panelId}
          role="group"
          aria-labelledby={headingId}
          className="fixed inset-x-4 top-12 z-120 rounded-lg border border-slate-700 bg-[#151821] py-1.5 text-sm shadow-[0_18px_40px_rgba(2,6,23,0.45)] sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-80"
        >
          <p
            id={headingId}
            className="truncate px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300"
          >
            <LangText text={playlist.title} />
          </p>
          <ol ref={listRef} className="relative max-h-[min(60vh,24rem)] overflow-y-auto">
            {playlist.lessons.map((lesson, index) => {
              const current = index === currentIndex;
              return (
                // This lesson: a bar at its edge (the tint alone is faint) and
                // aria-current. Every row has the border, so none shifts.
                <li key={lesson.slug}>
                  <Link
                    ref={current ? currentRef : undefined}
                    to={lessonHref(lesson.slug, listSlug)}
                    aria-current={current ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    // The app's focus ring, drawn inside: the scrolling list would clip it outside.
                    className={`flex items-baseline gap-2.5 border-l-2 py-1.5 pr-3 pl-2.5 -outline-offset-2 ${
                      current
                        ? "border-sky-300 bg-slate-800/70 text-white"
                        : "border-transparent text-slate-300 hover:bg-slate-800/40 hover:text-white"
                    }`}
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-slate-400">
                      {index + 1}
                    </span>
                    <span className="line-clamp-2 min-w-0 flex-1">
                      <LangText text={lesson.title} />
                    </span>
                    {lesson.duration && (
                      <span className="shrink-0 text-xs tabular-nums text-slate-400">
                        {lesson.duration}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
