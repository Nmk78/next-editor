import type { Playlist } from "../types";
import Breadcrumb from "@app/components/Breadcrumb";
import PlaylistLessons from "./PlaylistLessons";

// The playlist's own page (/learn/playlist/:slug): the trail back to the
// gallery, then the playlist as PlaylistLessons shows it everywhere.
export default function PlaylistDetail({ playlist }: { playlist: Playlist }) {
  return (
    <div className="py-4">
      <Breadcrumb title={playlist.title} />
      <PlaylistLessons playlist={playlist} />
    </div>
  );
}
