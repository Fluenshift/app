import { describe, expect, it } from "vitest";

import { parseMusicLink, toEmbedUrl } from "./music-link";

const SPOTIFY_ID = "37i9dQZF1DWWQRwui0ExPn";
const VIDEO_ID = "dQw4w9WgXcQ";
const LIST_ID = "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG";

describe("parseMusicLink", () => {
  it.each([
    [`https://open.spotify.com/playlist/${SPOTIFY_ID}?si=abc123`, "playlist"],
    [`https://open.spotify.com/intl-pt/playlist/${SPOTIFY_ID}`, "playlist"],
    [`https://open.spotify.com/embed/playlist/${SPOTIFY_ID}`, "playlist"],
    [`open.spotify.com/album/${SPOTIFY_ID}`, "album"],
    [`https://open.spotify.com/track/${SPOTIFY_ID}`, "track"],
    [`spotify:playlist:${SPOTIFY_ID}`, "playlist"],
  ])("parses Spotify link %s", (link, kind) => {
    expect(parseMusicLink(link)).toEqual({
      provider: "spotify",
      kind,
      id: SPOTIFY_ID,
    });
  });

  it.each([
    `https://www.youtube.com/playlist?list=${LIST_ID}`,
    `https://music.youtube.com/playlist?list=${LIST_ID}`,
    `https://www.youtube.com/watch?v=${VIDEO_ID}&list=${LIST_ID}&index=3`,
    `https://youtu.be/${VIDEO_ID}?list=${LIST_ID}`,
  ])("parses YouTube playlist link %s", (link) => {
    expect(parseMusicLink(link)).toEqual({
      provider: "youtube",
      kind: "playlist",
      id: LIST_ID,
    });
  });

  it.each([
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://m.youtube.com/watch?v=${VIDEO_ID}&t=42s`,
    `https://youtu.be/${VIDEO_ID}`,
    `  https://www.youtube.com/embed/${VIDEO_ID}  `,
  ])("parses YouTube video link %s", (link) => {
    expect(parseMusicLink(link)).toEqual({
      provider: "youtube",
      kind: "video",
      id: VIDEO_ID,
    });
  });

  it.each([
    "",
    "not a link",
    "https://example.com/playlist?list=PL123456789",
    `https://open.spotify.com/artist/${SPOTIFY_ID}`,
    "https://open.spotify.com/playlist/short",
    "https://www.youtube.com/watch?v=tooshort",
    "https://www.youtube.com/@somechannel",
    "spotify:show:abc",
    'https://www.youtube.com/watch?v="><script>',
  ])("rejects %j", (link) => {
    expect(parseMusicLink(link)).toBeNull();
  });
});

describe("toEmbedUrl", () => {
  it("builds the Spotify embed URL", () => {
    expect(
      toEmbedUrl({ provider: "spotify", kind: "album", id: SPOTIFY_ID })
    ).toBe(
      `https://open.spotify.com/embed/album/${SPOTIFY_ID}?utm_source=generator&theme=0`
    );
  });

  it("builds the YouTube playlist and video embed URLs", () => {
    expect(
      toEmbedUrl({ provider: "youtube", kind: "playlist", id: LIST_ID })
    ).toBe(`https://www.youtube.com/embed?listType=playlist&list=${LIST_ID}`);
    expect(
      toEmbedUrl({ provider: "youtube", kind: "video", id: VIDEO_ID })
    ).toBe(`https://www.youtube.com/embed/${VIDEO_ID}`);
  });
});
