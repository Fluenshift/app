// The Learner's saved Focus Music playlists, kept in browser storage. Ported from Grifando
// src/lib/savedPlaylists.ts (74dbb9f).
import type { MusicSource } from "./music-link";

export interface SavedPlaylist {
  readonly link: string;
  readonly name: string;
  readonly source: MusicSource;
}

export const MAX_SAVED_PLAYLISTS = 10;

export const DEFAULT_PLAYLIST: SavedPlaylist = {
  link: "https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn",
  name: "Deep Focus (Spotify)",
  source: {
    id: "37i9dQZF1DWWQRwui0ExPn",
    kind: "playlist",
    provider: "spotify",
  },
};

export const parseSavedPlaylists = (_raw: string | null): SavedPlaylist[] => [
  DEFAULT_PLAYLIST,
  DEFAULT_PLAYLIST,
];

export const serializeSavedPlaylists = (
  _playlists: readonly SavedPlaylist[]
): string => "";

export const addPlaylist = (
  _playlists: readonly SavedPlaylist[],
  _link: string,
  _name?: string
): SavedPlaylist[] | null => [];

export const removePlaylist = (
  playlists: readonly SavedPlaylist[],
  _source: MusicSource
): SavedPlaylist[] => [...playlists];
