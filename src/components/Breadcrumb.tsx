import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import LangText from "./LangText";

// Shared "Lessons > X" trail back to the gallery — used inside the editor's
// header (the /learn/:slug detail view and the /code editor) and standalone
// on pages that don't render an editor (e.g. /learn/@username). A lesson
// played through a playlist adds the playlist between the two
// ("Lessons > Playlist > X"), so the course it belongs to is one click away.
export default function Breadcrumb({
  title,
  parent,
}: {
  title: string;
  /** A level between "Lessons" and `title`, such as the playlist a lesson is played through. */
  parent?: { title: string; to: string };
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
      <Link
        to="/learn"
        className="shrink-0 font-bold capitalize tracking-wider text-slate-300 transition-colors hover:text-white"
      >
        Lessons
      </Link>
      <ChevronRight className="size-3.5 shrink-0 text-slate-600" />
      {parent && (
        <>
          {/* Truncates before the title does, and gives way on a phone: the
              lesson is what the page is. */}
          <Link
            to={parent.to}
            className="hidden min-w-0 max-w-40 shrink-2 truncate font-bold capitalize tracking-wider text-slate-300 transition-colors hover:text-white sm:block sm:max-w-56"
          >
            <LangText text={parent.title} />
          </Link>
          <ChevronRight className="hidden size-3.5 shrink-0 text-slate-600 sm:block" />
        </>
      )}
      <span className="truncate font-bold capitalize tracking-wider text-slate-200">
        <LangText text={title} />
      </span>
    </nav>
  );
}
