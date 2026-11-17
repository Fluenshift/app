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

const PLACEHOLDER: MusicSource = { id: "", kind: "video", provider: "youtube" };

export const parseMusicLink = (_input: string): MusicSource | null =>
  PLACEHOLDER;

export const toEmbedUrl = (_source: MusicSource): string => "";
