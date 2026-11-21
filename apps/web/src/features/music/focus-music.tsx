// Focus Music: a Spotify or YouTube player behind a header button, with the Learner's saved
// playlists. Ported from Grifando src/components/layout/FocusMusic.tsx (74dbb9f); it sits in the
// header of both profiles, beside the primary navigation (docs/adr/0039).
import { Button } from "@fluenshift/ui/components/button";
import { Input } from "@fluenshift/ui/components/input";
import { cn } from "@fluenshift/ui/utils";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import { parseMusicLink, toEmbedUrl } from "./music-link";
import type { MusicSource } from "./music-link";
import {
  addPlaylist,
  DEFAULT_PLAYLIST,
  isSameSource,
  parseSavedPlaylists,
  removePlaylist,
  serializeSavedPlaylists,
} from "./saved-playlists";
import type { SavedPlaylist } from "./saved-playlists";

const CURRENT_KEY = "focus-music:last-link";
const PLAYLISTS_KEY = "focus-music:playlists";

const REFUSED =
  "Paste a Spotify (playlist, album, track) or YouTube (playlist, video) link.";

// Storage can be unavailable (private window, blocked site data): every access is wrapped so the
// player still works for the current visit.
const readStorage = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the choice just won't survive a reload.
  }
};

// The source to play when the player first opens: the last link played, else the first saved
// playlist, else Deep Focus.
const firstSource = (
  saved: readonly SavedPlaylist[],
  current: string | null
): MusicSource =>
  (current === null ? null : parseMusicLink(current)) ??
  saved[0]?.source ??
  DEFAULT_PLAYLIST.source;

const isInside = (container: HTMLElement | null, target: EventTarget | null) =>
  target instanceof Node && container?.contains(target) === true;

export const FocusMusic = () => {
  const [open, setOpen] = useState(false);
  // null until first opened, so no third-party player loads on every page view.
  const [source, setSource] = useState<MusicSource | null>(null);
  const [playlists, setPlaylists] = useState<SavedPlaylist[]>([]);
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();

    const handlePointerDown = (event: PointerEvent) => {
      if (!isInside(containerRef.current, event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const toggle = () => {
    if (source === null) {
      const saved = parseSavedPlaylists(readStorage(PLAYLISTS_KEY));
      setPlaylists(saved);
      setSource(firstSource(saved, readStorage(CURRENT_KEY)));
    }
    setOpen((value) => !value);
  };

  const updatePlaylists = (next: SavedPlaylist[]) => {
    setPlaylists(next);
    writeStorage(PLAYLISTS_KEY, serializeSavedPlaylists(next));
  };

  const play = (playlist: SavedPlaylist) => {
    setSource(playlist.source);
    writeStorage(CURRENT_KEY, playlist.link);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = addPlaylist(playlists, link, name);
    if (next === null) {
      setError(REFUSED);
      return;
    }
    setError(null);
    updatePlaylists(next);
    // The playlist just added heads the list.
    const [added] = next;
    if (added !== undefined) {
      play(added);
    }
    setLink("");
    setName("");
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        aria-controls={panelId}
        aria-expanded={open}
        onClick={toggle}
        ref={buttonRef}
        size="sm"
        type="button"
        variant="ghost"
      >
        Focus music
      </Button>
      {/* Stays mounted once loaded and is only hidden when closed: unmounting the iframe would
          stop playback. The header lives in the root route, so it also survives client-side
          navigation. Grifando's frame had no sandbox. Spotify's and YouTube's players play only
          with their scripts and their own origin, a pair that lifts a sandbox only on the page's
          own origin; the sandbox still keeps the frame from navigating the page, from forms and
          from dialogs (docs/adr/0039). */}
      {source === null ? null : (
        <div
          aria-hidden={!open}
          className={cn(
            "rounded-card bg-card ring-border absolute top-full right-0 z-10 mt-2 w-80 max-w-[calc(100vw-2rem)] space-y-4 p-4 ring-1",
            !open && "invisible"
          )}
          id={panelId}
          inert={!open}
        >
          <iframe
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className={
              source.provider === "youtube"
                ? "aspect-video w-full"
                : "h-[152px] w-full"
            }
            key={`${source.provider}:${source.kind}:${source.id}`}
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation"
            src={toEmbedUrl(source)}
            style={{ border: 0, borderRadius: "4px" }}
            title="Focus music player"
          />
          {playlists.length > 0 ? (
            <ul aria-label="Saved playlists" className="space-y-1">
              {playlists.map((playlist) => {
                const isCurrent = isSameSource(playlist.source, source);
                return (
                  <li className="flex items-center gap-2" key={playlist.link}>
                    <button
                      aria-current={isCurrent ? "true" : undefined}
                      className={cn(
                        "min-w-0 flex-1 truncate text-left text-sm hover:underline",
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                      )}
                      onClick={() => {
                        play(playlist);
                      }}
                      type="button"
                    >
                      {playlist.name}
                    </button>
                    <Button
                      aria-label={`Remove ${playlist.name}`}
                      onClick={() => {
                        updatePlaylists(
                          removePlaylist(playlists, playlist.source)
                        );
                      }}
                      size="icon-xs"
                      type="button"
                      variant="ghost"
                    >
                      <X />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <form className="space-y-2" onSubmit={handleSubmit}>
            <Input
              aria-describedby={error === null ? undefined : errorId}
              aria-invalid={error === null ? undefined : true}
              aria-label="Spotify or YouTube link"
              onChange={(event) => {
                setLink(event.target.value);
              }}
              placeholder="Paste a Spotify or YouTube link"
              ref={inputRef}
              value={link}
            />
            <div className="flex items-end gap-2">
              <Input
                aria-label="Playlist name"
                maxLength={40}
                onChange={(event) => {
                  setName(event.target.value);
                }}
                placeholder="Name (optional)"
                value={name}
              />
              <Button size="sm" type="submit">
                Save &amp; play
              </Button>
            </div>
          </form>
          {error === null ? null : (
            <p className="text-destructive text-xs" id={errorId}>
              {error}
            </p>
          )}
          {source.provider === "spotify" ? (
            <p className="text-muted-foreground text-xs">
              Full tracks need you logged into Spotify in this browser;
              otherwise you hear 30s previews.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
};
