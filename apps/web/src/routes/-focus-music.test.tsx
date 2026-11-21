// Grifando's Focus Music player, src/components/layout/FocusMusic.tsx (74dbb9f), ported from
// source under docs/adr/0025, decision 5: no baseline test renders it, so these assert Grifando's
// copy, roles, storage keys and embed URLs. It sits in the header of both profiles, beside the
// primary navigation, which the root route keeps mounted, so closing it or changing pages never stops the music (Grifando
// #22), and its player is sandboxed, where Grifando's was not (docs/adr/0039).
import type { DeployProfile } from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const DEEP_FOCUS = "https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn";
const DEEP_FOCUS_EMBED =
  "https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn?utm_source=generator&theme=0";
const LOFI =
  "https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG";
const LOFI_EMBED =
  "https://www.youtube.com/embed?listType=playlist&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG";
const ARTIST = "https://open.spotify.com/artist/37i9dQZF1DWWQRwui0ExPn";
const REFUSED =
  "Paste a Spotify (playlist, album, track) or YouTube (playlist, video) link.";
const SPOTIFY_NOTE =
  "Full tracks need you logged into Spotify in this browser; otherwise you hear 30s previews.";
const PLAYLISTS_KEY = "focus-music:playlists";
const CURRENT_KEY = "focus-music:last-link";
// The narrowest sandbox both players play in: each needs its scripts and its own origin, so
// the sandbox keeps the frame from navigating the page, from forms and from dialogs
// (docs/adr/0039).
const PLAYER_SANDBOX =
  "allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation";

const renderAt = (url: string, deployProfile: DeployProfile = "local") =>
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient: createInMemoryAcademyClient(),
        deployProfile,
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: [url] }),
      })}
    />
  );

const storePlaylists = (
  playlists: readonly { readonly link: string; readonly name: string }[]
) => {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
};

const toggle = () => screen.getByRole("button", { name: "Focus music" });

const player = () => screen.getByTitle("Focus music player");

const linkField = () =>
  screen.getByRole("textbox", { name: "Spotify or YouTube link" });

const nameField = () => screen.getByRole("textbox", { name: "Playlist name" });

// Opens the player once the shell has rendered, and answers its iframe.
const openPlayer = async () => {
  await userEvent.click(
    await screen.findByRole("button", { name: "Focus music" })
  );
  return player();
};

// Each saved playlist as its name and whether it is the one playing.
const savedPlaylists = () =>
  within(screen.getByRole("list", { name: "Saved playlists" }))
    .getAllByRole("listitem")
    .map((item) => {
      const [play] = within(item).getAllByRole("button");
      return [play?.textContent, play?.getAttribute("aria-current")];
    });

const saveAndPlay = async (link: string, name?: string) => {
  await userEvent.type(linkField(), link);
  if (name !== undefined) {
    await userEvent.type(nameField(), name);
  }
  await userEvent.click(screen.getByRole("button", { name: "Save & play" }));
};

const blocked = () => {
  throw new DOMException("The browser blocks site data.", "SecurityError");
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("Focus Music", () => {
  it("sits in the header beside the primary navigation and loads no player until opened", async () => {
    renderAt("/");
    const button = await screen.findByRole("button", { name: "Focus music" });

    expect(
      screen
        .getByRole("navigation", { name: "Primary navigation" })
        .closest("header")
    ).toContainElement(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTitle("Focus music player")).not.toBeInTheDocument();
  });

  it("opens on Spotify's Deep Focus playlist the first time", async () => {
    renderAt("/");
    const iframe = await openPlayer();

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(iframe).toHaveAttribute("src", DEEP_FOCUS_EMBED);
    expect(iframe).toHaveAttribute(
      "allow",
      "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    );
    expect(iframe).toHaveAttribute("sandbox", PLAYER_SANDBOX);
    expect(savedPlaylists()).toEqual([["Deep Focus (Spotify)", "true"]]);
    expect(
      screen.getByRole("button", { name: "Remove Deep Focus (Spotify)" })
    ).toBeInTheDocument();
    expect(linkField()).toHaveFocus();
    expect(linkField()).toHaveAttribute(
      "placeholder",
      "Paste a Spotify or YouTube link"
    );
    expect(nameField()).toHaveAttribute("placeholder", "Name (optional)");
    expect(nameField()).toHaveAttribute("maxlength", "40");
    expect(screen.getByText(SPOTIFY_NOTE)).toBeInTheDocument();
  });

  it("saves a pasted link and plays it first", async () => {
    renderAt("/");
    await openPlayer();
    // A browser would load the page again on a submission nothing stops, and the music with it.
    const submissions: boolean[] = [];
    const recordSubmission = (event: Event) => {
      submissions.push(event.defaultPrevented);
    };
    document.addEventListener("submit", recordSubmission);
    await saveAndPlay(LOFI, "Lo-fi");
    document.removeEventListener("submit", recordSubmission);

    expect(submissions).toEqual([true]);
    expect(player()).toHaveAttribute("src", LOFI_EMBED);
    expect(savedPlaylists()).toEqual([
      ["Lo-fi", "true"],
      ["Deep Focus (Spotify)", null],
    ]);
    expect(linkField()).toHaveValue("");
    expect(nameField()).toHaveValue("");
    expect(screen.queryByText(SPOTIFY_NOTE)).not.toBeInTheDocument();
    expect(localStorage.getItem(PLAYLISTS_KEY)).toBe(
      JSON.stringify([
        { link: LOFI, name: "Lo-fi" },
        { link: DEEP_FOCUS, name: "Deep Focus (Spotify)" },
      ])
    );
    expect(localStorage.getItem(CURRENT_KEY)).toBe(LOFI);
  });

  it("refuses a link it cannot play and keeps the player", async () => {
    renderAt("/");
    await openPlayer();
    await saveAndPlay(ARTIST);

    expect(screen.getByText(REFUSED)).toBeInTheDocument();
    expect(linkField()).toHaveAttribute("aria-invalid", "true");
    expect(linkField()).toHaveAccessibleDescription(REFUSED);
    expect(linkField()).toHaveValue(ARTIST);
    expect(player()).toHaveAttribute("src", DEEP_FOCUS_EMBED);
    expect(localStorage.getItem(PLAYLISTS_KEY)).toBeNull();

    await userEvent.clear(linkField());
    await saveAndPlay(LOFI);

    expect(screen.queryByText(REFUSED)).not.toBeInTheDocument();
    expect(linkField()).not.toHaveAttribute("aria-invalid");
    expect(linkField()).not.toHaveAttribute("aria-describedby");
  });

  it("opens on the last link it played", async () => {
    storePlaylists([
      { link: LOFI, name: "Lo-fi" },
      { link: DEEP_FOCUS, name: "Deep Focus (Spotify)" },
    ]);
    localStorage.setItem(CURRENT_KEY, DEEP_FOCUS);
    renderAt("/");

    expect(await openPlayer()).toHaveAttribute("src", DEEP_FOCUS_EMBED);
    expect(savedPlaylists()).toEqual([
      ["Lo-fi", null],
      ["Deep Focus (Spotify)", "true"],
    ]);
  });

  it("opens on the first saved playlist when the last link does not parse", async () => {
    storePlaylists([{ link: LOFI, name: "Lo-fi" }]);
    localStorage.setItem(CURRENT_KEY, "not a link");
    renderAt("/");

    expect(await openPlayer()).toHaveAttribute("src", LOFI_EMBED);
    expect(savedPlaylists()).toEqual([["Lo-fi", "true"]]);
  });

  it("plays Deep Focus over an emptied list without listing it", async () => {
    storePlaylists([]);
    renderAt("/");

    expect(await openPlayer()).toHaveAttribute("src", DEEP_FOCUS_EMBED);
    expect(
      screen.queryByRole("list", { name: "Saved playlists" })
    ).not.toBeInTheDocument();
  });

  it("switches between saved playlists and removes them", async () => {
    storePlaylists([
      { link: LOFI, name: "Lo-fi" },
      { link: DEEP_FOCUS, name: "Deep Focus (Spotify)" },
    ]);
    renderAt("/");
    await openPlayer();
    await userEvent.click(
      screen.getByRole("button", { name: "Deep Focus (Spotify)" })
    );

    expect(player()).toHaveAttribute("src", DEEP_FOCUS_EMBED);
    expect(savedPlaylists()).toEqual([
      ["Lo-fi", null],
      ["Deep Focus (Spotify)", "true"],
    ]);
    expect(localStorage.getItem(CURRENT_KEY)).toBe(DEEP_FOCUS);

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Deep Focus (Spotify)" })
    );

    expect(savedPlaylists()).toEqual([["Lo-fi", null]]);
    expect(localStorage.getItem(PLAYLISTS_KEY)).toBe(
      JSON.stringify([{ link: LOFI, name: "Lo-fi" }])
    );
    expect(player()).toHaveAttribute("src", DEEP_FOCUS_EMBED);

    await userEvent.click(screen.getByRole("button", { name: "Remove Lo-fi" }));

    expect(
      screen.queryByRole("list", { name: "Saved playlists" })
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(PLAYLISTS_KEY)).toBe("[]");
  });

  it("hides the player on Escape and on a click outside without unloading it", async () => {
    renderAt("/");
    const iframe = await openPlayer();
    const panel = iframe.parentElement;

    expect(panel).toHaveAttribute("id", toggle().getAttribute("aria-controls"));

    await userEvent.click(nameField());

    expect(toggle()).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{Escape}");

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveFocus();
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");
    expect(player()).toBe(iframe);

    await userEvent.click(toggle());

    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(panel).not.toHaveAttribute("inert");
    expect(player()).toBe(iframe);

    await userEvent.click(
      screen.getByRole("heading", { level: 1, name: "Writing Desk" })
    );

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(player()).toBe(iframe);
  });

  it("keeps playing across pages in the hosted profile", async () => {
    renderAt("/privacy", "hosted");
    const iframe = await openPlayer();
    await userEvent.click(
      within(
        screen.getByRole("navigation", { name: "Primary navigation" })
      ).getByRole("link", { name: "Key settings" })
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Your AI key" })
    ).toBeInTheDocument();
    expect(player()).toBe(iframe);
    expect(iframe).toHaveAttribute("src", DEEP_FOCUS_EMBED);
  });

  it("plays and saves for the visit when the browser blocks storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    renderAt("/");

    expect(await openPlayer()).toHaveAttribute("src", DEEP_FOCUS_EMBED);

    await saveAndPlay(LOFI);

    expect(player()).toHaveAttribute("src", LOFI_EMBED);
    expect(savedPlaylists()).toEqual([
      ["YouTube playlist", "true"],
      ["Deep Focus (Spotify)", null],
    ]);

    // Storage is read only the first time the player opens, so closing and opening it again
    // keeps what the Learner chose during the visit.
    await userEvent.click(toggle());
    await userEvent.click(toggle());

    expect(player()).toHaveAttribute("src", LOFI_EMBED);
    expect(savedPlaylists()).toEqual([
      ["YouTube playlist", "true"],
      ["Deep Focus (Spotify)", null],
    ]);
  });
});
