import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router";
import LangText from "@app/components/LangText";
import type { PlaylistSummary } from "@next-editor/infra";
import { galleryPlaylistHref } from "../lib/galleryParams";

/**
 * The gallery's "browse by playlist" row: every lesson, or one playlist's
 * lessons in its own order. Links, not toggles: each choice is its own URL,
 * so it can be shared and Back returns to the last one. On a phone the row
 * scrolls sideways; from `sm` up it wraps.
 */
export default function PlaylistFilter({
  playlists,
  selected,
}: {
  playlists: PlaylistSummary[];
  /** The slug of the playlist showing, or "" for every lesson. */
  selected: string;
}) {
  const rowRef = useRef<HTMLElement>(null);
  // On a phone the row scrolls sideways: bring the chosen playlist into view
  // (a shared link may choose one far along the row). Only the row scrolls, not
  // the page, so it sets the row's own scroll rather than calling scrollIntoView.
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !chip) return;
    const outside =
      chip.offsetLeft < row.scrollLeft ||
      chip.offsetLeft + chip.offsetWidth > row.scrollLeft + row.clientWidth;
    if (outside) row.scrollLeft = chip.offsetLeft - 24;
  }, [selected, playlists.length]);

  if (playlists.length === 0) return null;

  return (
    // `relative` makes the row the containing block of its screen-reader-only
    // (absolutely placed) text, so the row's scrolling clips that text too
    // instead of it widening the whole page on a phone.
    <nav
      ref={rowRef}
      aria-label="Browse by playlist"
      className="relative -mx-6 mb-6 overflow-x-auto px-6 sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        <li>
          <Chip to="/learn" current={!selected}>
            All lessons
          </Chip>
        </li>
        {playlists.map((playlist) => (
          <li key={playlist.slug}>
            <Chip to={galleryPlaylistHref(playlist.slug)} current={playlist.slug === selected}>
              {/* One flex item: LangText splits a title into a text run and a
                  lang="my" span, which the chip's gap would otherwise space apart. */}
              <span>
                <LangText text={playlist.title} />
              </span>
              {/* The bare count for the eye, the phrase for the ear: a phrase
                  split around the number loses its spaces in the link's name. */}
              <span
                aria-hidden="true"
                className={playlist.slug === selected ? "text-slate-600" : "text-slate-400"}
              >
                {playlist.lessonCount}
              </span>
              <span className="sr-only">, {playlist.lessonCount} lessons</span>
            </Chip>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Chip({ to, current, children }: { to: string; current: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={current ? "page" : undefined}
      className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        current
          ? "border-white bg-white text-slate-950"
          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
