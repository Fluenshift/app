# HANDOFF — merge setup

Start here after a context reset. Written 2026-11-10, then revised the same day for the
organization layout. Read in this order:

1. this file;
2. `PRE_MIGRATION.md`: stack, product direction, agent rules;
3. `MIGRATION_PROTOCOL.md`: how the migration runs.

## Topology

One GitHub organization, with both owners as Owners, holds three public repositories:

| Repository | Comes from | Role until cutover | At cutover |
| --- | --- | --- | --- |
| `<org>/prompt-evolution` | PE, pushed for the first time. PE has no remote, so creating the repo in the organization is its transfer. | Frozen source, tagged `parity-baseline`. Archived once its pin is verified. | Stays archived. |
| `<org>/grifando` | Transferred from `levyrodrigues23/grifando`. | Live product on Vercel, and frozen source tagged `parity-baseline`. | Archived once the product replaces it. |
| `<org>/<product>` | New and empty. | The merged product. All migration work happens here. | The product. |

Decisions behind this layout:

- The product repo imports no source history. It pins each baseline by commit SHA in
  `docs/migration/baselines.json`. A SHA cannot move. The tag in each source repo only keeps
  the commit reachable, and a tag ruleset stops anyone from moving or deleting it. Each source
  repo keeps its own history, issues and pull requests.
- The organization is needed for two reasons:
  - a repo owned by a personal account cannot give a collaborator admin rights;
  - GitHub's merge queue exists only for public repos owned by an organization.
- Work units and owner decision requests are GitHub Issues in the product repo (decided
  2026-11-10). The ledger, the ADRs and the docs stay versioned in the repo.

## Current state

- Both owners approved the merge and the stack.
- The migration protocol is written.
- Live calibration is deferred until after parity. The priority is the merged repo working.

Fill in once known, in the product repo's copy of this file:

| Item | Value |
| --- | --- |
| Organization | `Fluenshift` (<https://github.com/Fluenshift>) |
| Product repo URL | <https://github.com/Fluenshift/app> (`app` is a working name until the product is named) |
| Product license | MIT |
| PE license | MIT |
| What Grifando may change until cutover | _to fill (step 3)_ |
| PE baseline SHA (`Fluenshift/prompt-evolution` tag `parity-baseline`) | `5e831bb6f2af1ae0f52c2ff1af1c28c605a25486` |
| Grifando baseline SHA (`Fluenshift/grifando` tag `parity-baseline`) | `74dbb9f3305faa4444f981aa2df360c028d3ab08` |

Setup status on 2026-11-12, checked with `gh` and `git ls-remote`: the ticked boxes below
are done.

- Both tags resolve to the SHAs in the table. Each sits under an active tag ruleset that
  restricts updates and deletions, with an empty bypass list. Grifando's `main` still equals
  its baseline, and PE's `main` equals its baseline.
- The "GitHub recommended" code security configuration is attached to all three repos, and
  each repo's default workflow token is read-only.
- Jhefferson applied the step 1 organization settings on 2026-11-12. They were not read
  back, because that needs the `admin:org` scope.
- Each owner chooses the GitHub credentials their agent sessions use (decided 2026-11-12).

## Setup checklist

Steps 2–4 (Levy) and step 5 (Jhefferson) can run in parallel. The first agent session needs
every step done. Grifando's deploy and CI after the transfer are deferred (see Deferred); the
migration does not depend on them.

### 1. Organization (either owner creates it)

- [x] Create a free organization. Choose the name together; it is also the product's home.
- [x] Invite the other owner (`jheffersonsouza` or `levyrodrigues23`) as an organization
      **Owner**. The other owner accepts.
- [x] In the organization settings:
  - Actions → General → Workflow permissions: read repository contents only;
  - Actions → General → fork pull request workflows: require approval for all outside
    contributors;
  - Code security → Configurations: apply the GitHub recommended configuration to all
    repositories (secret scanning, push protection and Dependabot alerts, free on public
    repos).

### 2. Move Grifando into the organization (Levy)

- [x] Settings → General → Danger Zone → Transfer, to the organization. Keep the repo public.
      Repo secrets, issues and pull requests move with it, and GitHub redirects the old URLs.
- [ ] Point every local clone at the new URL:

  ```bash
  git remote set-url origin https://github.com/<org>/grifando.git
  ```

### 3. What Grifando may change until cutover (both owners)

- [ ] Decide what may change in Grifando between its baseline and the cutover. Recommended:
      production and security fixes only; features go to the product repo. Every change
      after the baseline needs a baseline bump (`MIGRATION_PROTOCOL.md` § Baseline bumps),
      so keep them rare. Record the decision in the table.

### 4. Grifando baseline (Levy)

- [x] Pick the commit. Suggested: today's `main`, `74dbb9f`. It is the head of the
      production branch, its CI run on 2026-11-08 was green, and its tree equals `develop`.
      The tag can be created before or after the transfer.
- [x] Tag it and push the tag:

  ```bash
  git tag -a parity-baseline -m "Parity baseline for the merge" <sha>
  git push origin parity-baseline
  ```

- [x] Add a tag ruleset (Settings → Rules → Rulesets → New tag ruleset): target
      `parity-baseline*`, restrict updates, restrict deletions, empty bypass list.

### 5. Prompt Evolution (Jhefferson)

PE becomes public in this step. Two private files are already ignored by git:
`apps/server/.env`, which holds the API key, and `.data/local.db`, which holds personal
evaluations. A secret scan is still required before the first push. PE's commits use the
GitHub noreply address, so its history exposes no personal email.

- [x] Decide on the untracked tool and personal files: `.codex/`, `.mcp.json` and
      `.scratch/prompt-notes.md`, a raw prompt log. On 2026-11-10 none of them contained
      token-like strings. Commit each one or add it to `.gitignore`.
- [x] Decide PE's own license: add MIT, as Grifando has, or publish with no license (all
      rights reserved). This does not block the port: the author of PE's code can license it
      in the product.
- [x] Commit the MVP. Leave `.scratch/merge-grifando/` out: these docs move to the product
      repo in step 6.

  ```bash
  cd <path-to>/prompt-evolution
  git add -A -- . ':!.scratch/merge-grifando'
  git status   # apps/server/.env and .data/ must not appear; bun.lock must
  git commit -m "feat: ship the evaluation MVP"
  ```

- [x] Secret-scan the whole history. It must report no leaks. Nothing is pushed yet, so a
      leak can still be fixed by amending the commit.

  ```bash
  mise exec gitleaks@latest -- gitleaks git -v .
  # or:
  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:latest git -v /repo
  ```

- [x] Create `<org>/prompt-evolution` as a public, **empty** repo: no README, LICENSE or
      .gitignore, so the local history pushes as it is.
- [x] Rename the branch, push, then tag the baseline:

  ```bash
  git branch -m master main
  git remote add origin https://github.com/<org>/prompt-evolution.git
  git push -u origin main
  git tag -a parity-baseline -m "Parity baseline for the merge"
  git push origin parity-baseline
  ```

- [x] Add the same tag ruleset as in step 4.
- [ ] Archive the repo (Settings → General → Archive this repository). Its pin was verified
      on 2026-11-12. An archived repo is read-only for everyone, including an agent that
      holds an owner token. It can be unarchived.

### 6. Product repo

- [x] Choose the repo name. If the product name is still open, use a working name; renaming
      later keeps redirects. Do not reuse `grifando` or `prompt-evolution` while the source
      repos hold those names.
- [x] Create a **public** repo in the organization: default branch `main`, the agreed
      LICENSE, no README and no .gitignore.
- [x] Add a branch ruleset on `main` now: block force pushes and restrict deletions. Pull
      requests only, required checks and the merge queue come in Phase 2, once CI exists.
- [x] Clone the product repo next to `prompt-evolution`, then push the handoff docs as the
      first commit after LICENSE:

  ```bash
  git clone https://github.com/<org>/<product>.git
  cd <product>
  mkdir -p docs/migration
  cp ../prompt-evolution/.scratch/merge-grifando/{HANDOFF,PRE_MIGRATION,MIGRATION_PROTOCOL}.md docs/migration/
  git add docs/migration
  git commit -m "docs: add migration handoff"
  git push origin main
  ```

  After the push, delete `.scratch/merge-grifando/` from PE's working tree. It was never
  committed there.

### 7. Toolchain (every machine that runs agents)

- [ ] For the product repo: Node 26.13.0 (via mise, nvm or fnm) and pnpm 12.18.0
      (`npm install -g pnpm@12.18.0`, or mise).
- [ ] Docker, running.
- [ ] Each baseline runs on its own toolchain:
  - PE: Bun 1.4.0 (`mise install` in a PE checkout) and the Playwright browsers;
  - Grifando: Node 24 (from `.nvmrc`), pnpm 12.3.4 (from `packageManager`), and
    `docker pull postgres:17-alpine`, the image its CI uses.
- [ ] Fill in the table above, in the product repo's `docs/migration/HANDOFF.md`.

## Next session

Open Claude Code or Codex in the product repo and say:

> Read `docs/migration/HANDOFF.md`, verify its setup checklist, then start Phase 0 of
> `docs/migration/MIGRATION_PROTOCOL.md`.

The first agent work:

1. Verify the setup:
   - the organization owns the three repos, and all three are public;
   - each source repo has the `parity-baseline` tag, under a tag ruleset;
   - the product repo's `main` has its ruleset and holds the docs;
   - the toolchain versions match.
2. Resolve both tags with `git ls-remote` and write the pins to
   `docs/migration/baselines.json`. Write the toolchains and run commands to
   `docs/migration/BASELINES.md`.
3. Create the issue labels listed in `MIGRATION_PROTOCOL.md` § Work unit cycle.
4. Run both baseline suites from clones at the pinned commits, outside the product working
   tree, and store the reports in `docs/migration/baseline-runs/`.
5. Build the inventory and seed the ledger (Phase 0 steps 4–6). Then write the
   characterization tests (step 7) while a documentation session starts Phase 1 with the
   owners.

## Deferred

- Live calibration (G13), with a new budget. It runs after parity.
- The product decisions listed in Phase 1 of the protocol. Agents implement neither side
  until an ADR is accepted.
- Grifando's deploy and CI after the transfer. The owners decide them together with the
  product's deploy model, which may not stay on Vercel. Until then:
  - the Vercel GitHub App is installed on Levy's personal account, so pushes to
    `<org>/grifando` may stop deploying. The live site keeps serving its last deployment,
    but a production fix may not go out. The fix: install the app on the organization and
    reconnect the project in Settings → Git. Vercel Hobby deploys only public organization
    repos.
  - `gitleaks/gitleaks-action` fails in organization repos without a `GITLEAKS_LICENSE`
    secret (the key is free), so Grifando's "Secret scan" job stays red.
  - Apps on Levy's account, such as ImgBot, stay behind. The links to
    `levyrodrigues23/grifando` stay as they are, and GitHub redirects them. They are in the
    README badge, `package.json`, the site footer, the issue templates, `CLAUDE.md` and
    `docs/deploy.md`.
  - None of this blocks the migration: the baselines are pinned SHAs, and their suites run
    outside Grifando's CI.
