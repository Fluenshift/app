// Focus Music links: Spotify and YouTube share links parsed into a validated source, and the
// embed URL built from it. Ported from Grifando src/lib/musicLink.ts (74dbb9f).
export type MusicSource =
  | {
      readonly id: string;
      readonly kind: "album" | "playlist" | "track";
      readonly provider: "spotify";
    }
  | {
      readonly id: string;
      readonly kind: "playlist" | "video";
      readonly provider: "youtube";
    };

const SPOTIFY_KINDS = ["playlist", "album", "track"] as const;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/u;
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const YOUTUBE_LIST_ID = /^[A-Za-z0-9_-]{10,}$/u;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

const isSpotifyKind = (
  value: string
): value is (typeof SPOTIFY_KINDS)[number] =>
  (SPOTIFY_KINDS as readonly string[]).includes(value);

const spotifySource = (kind: string, id: string): MusicSource | null =>
  isSpotifyKind(kind) && SPOTIFY_ID.test(id)
    ? { id, kind, provider: "spotify" }
    : null;

// A link carrying a playlist (`list=`) plays the whole playlist, even when it was copied from a
// single video inside it.
const youtubeSource = (
  videoId: string | null,
  listId: string | null
): MusicSource | null => {
  if (listId !== null && YOUTUBE_LIST_ID.test(listId)) {
    return { id: listId, kind: "playlist", provider: "youtube" };
  }
  if (videoId !== null && YOUTUBE_VIDEO_ID.test(videoId)) {
    return { id: videoId, kind: "video", provider: "youtube" };
  }
  return null;
};

const toUrl = (text: string): URL | null => {
  try {
    return new URL(/^https?:\/\//iu.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
};

const youtubeHostSource = (url: URL, segments: readonly string[]) => {
  const list = url.searchParams.get("list");
  if (segments[0] === "watch") {
    return youtubeSource(url.searchParams.get("v"), list);
  }
  if (segments[0] === "playlist") {
    return youtubeSource(null, list);
  }
  if (
    segments[0] === "embed" ||
    segments[0] === "shorts" ||
    segments[0] === "live"
  ) {
    return youtubeSource(segments[1] ?? null, list);
  }
  return null;
};

// Accepts the share links Learners actually paste (Spotify web or URI, YouTube watch, playlist,
// youtu.be or music) and returns null for anything else, so the iframe source is only ever built
// from a validated provider and id.
export const parseMusicLink = (input: string): MusicSource | null => {
  const text = input.trim();

  const uri = /^spotify:(?<kind>\w+):(?<id>\w+)$/u.exec(text);
  if (uri !== null) {
    return spotifySource(uri.groups?.["kind"] ?? "", uri.groups?.["id"] ?? "");
  }

  const url = toUrl(text);
  if (url === null) {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter((segment) => segment !== "");

  if (host === "open.spotify.com") {
    // Drops locale (`/intl-pt/`) and embed (`/embed/`) prefixes.
    const rest = segments.filter(
      (segment) => !segment.startsWith("intl-") && segment !== "embed"
    );
    return rest.length >= 2
      ? spotifySource(rest[0] ?? "", rest[1] ?? "")
      : null;
  }

  if (host === "youtu.be") {
    return youtubeSource(segments[0] ?? null, url.searchParams.get("list"));
  }

  return YOUTUBE_HOSTS.has(host) ? youtubeHostSource(url, segments) : null;
};

export const toEmbedUrl = (source: MusicSource): string => {
  if (source.provider === "spotify") {
    return `https://open.spotify.com/embed/${source.kind}/${source.id}?utm_source=generator&theme=0`;
  }
  return source.kind === "playlist"
    ? `https://www.youtube.com/embed?listType=playlist&list=${source.id}`
    : `https://www.youtube.com/embed/${source.id}`;
};
