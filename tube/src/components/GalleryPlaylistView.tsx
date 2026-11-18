import { Link } from "react-router";
import LessonCardSkeleton from "@app/components/LessonCardSkeleton";
import { usePlaylist } from "../hooks/usePlaylists";
import PlaylistLessons from "./PlaylistLessons";

const pillButton =
  "rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-white hover:text-slate-950";

/**
 * The gallery showing one playlist (/learn?playlist=…) in place of every
 * lesson: the playlist as its own page shows it, under the gallery's heading.
 */
export default function GalleryPlaylistView({ slug }: { slug: string }) {
  const { data: playlist, isPending, isError, refetch } = usePlaylist(slug);

  if (isPending) {
    return (
      <div aria-hidden="true">
        <div className="animate-pulse py-6">
          <div className="h-3.5 w-40 rounded bg-slate-800" />
          <div className="mt-1.5 h-8 w-2/3 max-w-md rounded bg-slate-800" />
          <div className="mt-4 h-9 w-28 rounded-full bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 gap-5 pb-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <LessonCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center text-slate-300">
        <p role={isError ? "alert" : undefined} className="text-sm">
          {isError ? "Failed to load playlist." : "Playlist not found."}
        </p>
        <div className="flex gap-3">
          {isError && (
            <button type="button" onClick={() => void refetch()} className={pillButton}>
              Try again
            </button>
          )}
          <Link to="/learn" className={pillButton}>
            Show all lessons
          </Link>
        </div>
      </div>
    );
  }

  return <PlaylistLessons playlist={playlist} titleAs="h2" />;
}
