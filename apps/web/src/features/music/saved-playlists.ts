// The Learner's saved Focus Music playlists, kept in browser storage. Ported from Grifando
// src/lib/savedPlaylists.ts (74dbb9f).
import { parseMusicLink } from "./music-link";
import type { MusicSource } from "./music-link";

export interface SavedPlaylist {
  readonly link: string;
  readonly name: string;
  readonly source: MusicSource;
}

export const MAX_SAVED_PLAYLISTS = 10;
const MAX_NAME_LENGTH = 40;

export const DEFAULT_PLAYLIST: SavedPlaylist = {
  link: "https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn",
  name: "Deep Focus (Spotify)",
  source: {
    id: "37i9dQZF1DWWQRwui0ExPn",
    kind: "playlist",
    provider: "spotify",
  },
};

const sourceKey = (source: MusicSource): string =>
  `${source.provider}:${source.kind}:${source.id}`;

export const isSameSource = (a: MusicSource, b: MusicSource): boolean =>
  sourceKey(a) === sourceKey(b);

export const defaultPlaylistName = (source: MusicSource): string =>
  `${source.provider === "spotify" ? "Spotify" : "YouTube"} ${source.kind}`;

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

const labelOf = (name: unknown): string | null =>
  typeof name === "string" && name.trim() !== ""
    ? name.trim().slice(0, MAX_NAME_LENGTH)
    : null;

// Browser storage is untrusted (edited by hand, an older format, another app on the same
// origin): every entry is parsed again from its link, and anything that does not parse is
// dropped rather than breaking the player.
export const parseSavedPlaylists = (raw: string | null): SavedPlaylist[] => {
  if (raw === null || raw === "") {
    return [DEFAULT_PLAYLIST];
  }
  const data = parseJson(raw);
  if (!Array.isArray(data)) {
    return [DEFAULT_PLAYLIST];
  }

  const playlists: SavedPlaylist[] = [];
  for (const entry of data as unknown[]) {
    if (typeof entry === "object" && entry !== null) {
      const { link, name } = entry as Record<string, unknown>;
      const source = typeof link === "string" ? parseMusicLink(link) : null;
      if (
        typeof link === "string" &&
        source !== null &&
        !playlists.some((playlist) => isSameSource(playlist.source, source))
      ) {
        playlists.push({
          link,
          name: labelOf(name) ?? defaultPlaylistName(source),
          source,
        });
      }
    }
  }
  return playlists.slice(0, MAX_SAVED_PLAYLISTS);
};

export const serializeSavedPlaylists = (
  playlists: readonly SavedPlaylist[]
): string =>
  JSON.stringify(playlists.map(({ link, name }) => ({ link, name })));

// Most recently added first; adding an existing source again moves it to the top and renames
// it when a new name is given. The oldest entry falls off past the cap.
export const addPlaylist = (
  playlists: readonly SavedPlaylist[],
  link: string,
  name?: string
): SavedPlaylist[] | null => {
  const source = parseMusicLink(link);
  if (source === null) {
    return null;
  }
  const existing = playlists.find((playlist) =>
    isSameSource(playlist.source, source)
  );
  const given = name?.trim().slice(0, MAX_NAME_LENGTH) ?? "";
  const label =
    given === "" ? (existing?.name ?? defaultPlaylistName(source)) : given;
  const rest = playlists.filter(
    (playlist) => !isSameSource(playlist.source, source)
  );
  return [{ link: link.trim(), name: label, source }, ...rest].slice(
    0,
    MAX_SAVED_PLAYLISTS
  );
};

export const removePlaylist = (
  playlists: readonly SavedPlaylist[],
  source: MusicSource
): SavedPlaylist[] =>
  playlists.filter((playlist) => !isSameSource(playlist.source, source));
