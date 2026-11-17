import { describe, expect, it } from "vitest";

import {
  addPlaylist,
  DEFAULT_PLAYLIST,
  MAX_SAVED_PLAYLISTS,
  parseSavedPlaylists,
  removePlaylist,
  serializeSavedPlaylists,
} from "./saved-playlists";

// Grifando wrote `added(...)`; lint forbids the non-null assertion, so this throws instead.
const added = (...args: Parameters<typeof addPlaylist>) => {
  const playlists = addPlaylist(...args);
  if (playlists === null) {
    throw new Error("Expected the link to parse");
  }
  return playlists;
};

const SPOTIFY = "https://open.spotify.com/playlist/37i9dQZF1DX8NTLI2TtZa6";
const YOUTUBE =
  "https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG";

describe("parseSavedPlaylists", () => {
  it("falls back to the default playlist for missing or corrupt storage", () => {
    expect(parseSavedPlaylists(null)).toEqual([DEFAULT_PLAYLIST]);
    expect(parseSavedPlaylists("{not json")).toEqual([DEFAULT_PLAYLIST]);
    expect(parseSavedPlaylists('{"a":1}')).toEqual([DEFAULT_PLAYLIST]);
  });

  it("keeps a deliberately emptied list empty", () => {
    expect(parseSavedPlaylists("[]")).toEqual([]);
  });

  it("drops invalid and duplicate entries and round-trips through serialize", () => {
    const raw = JSON.stringify([
      { name: "Lofi", link: YOUTUBE },
      { name: "Bad", link: "https://example.com" },
      { name: 42, link: SPOTIFY },
      { name: "Dup", link: `${YOUTUBE}&si=x` },
      "garbage",
    ]);
    const playlists = parseSavedPlaylists(raw);
    expect(playlists.map((p) => p.name)).toEqual(["Lofi", "Spotify playlist"]);
    expect(parseSavedPlaylists(serializeSavedPlaylists(playlists))).toEqual(
      playlists
    );
  });
});

describe("addPlaylist / removePlaylist", () => {
  it("adds to the top, moves an existing source up, and renames it when given a name", () => {
    const one = added([DEFAULT_PLAYLIST], YOUTUBE, "Lofi");
    expect(one.map((p) => p.name)).toEqual(["Lofi", DEFAULT_PLAYLIST.name]);

    const two = added(one, DEFAULT_PLAYLIST.link);
    expect(two.map((p) => p.name)).toEqual([DEFAULT_PLAYLIST.name, "Lofi"]);

    const three = added(two, YOUTUBE, "Study");
    expect(three.map((p) => p.name)).toEqual(["Study", DEFAULT_PLAYLIST.name]);
  });

  it("rejects links that don't parse", () => {
    expect(addPlaylist([], "not a link")).toBeNull();
  });

  it("caps the list, dropping the oldest entry", () => {
    let playlists = [DEFAULT_PLAYLIST];
    for (let i = 0; i < MAX_SAVED_PLAYLISTS; i += 1) {
      playlists = added(
        playlists,
        `https://youtu.be/${String(i).padStart(11, "a")}`
      );
    }
    expect(playlists).toHaveLength(MAX_SAVED_PLAYLISTS);
    expect(playlists.some((p) => p.name === DEFAULT_PLAYLIST.name)).toBe(false);
  });

  it("removes by source", () => {
    expect(removePlaylist([DEFAULT_PLAYLIST], DEFAULT_PLAYLIST.source)).toEqual(
      []
    );
  });
});
