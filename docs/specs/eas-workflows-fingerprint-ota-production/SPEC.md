# Feature: EAS Workflows Fingerprint Gate + OTA Update Path for Android Production

## Intent

Running the production EAS Workflow no longer always triggers a full native Android
build: it fingerprints the project first, reuses an existing production build when the
native layer is unchanged, and pushes an EAS Update over-the-air to matching installs
instead — only rebuilding when the fingerprint has no matching build.

## Context

- **Problem statement:** GitHub issue #43 describes a production EAS Workflow
  (`Android Production Build & Deploy`) that always runs a full native `build` job on
  `workflow_dispatch`, with no fingerprint-based skip and no OTA path. **That workflow,
  and everything it depends on, does not exist in this repository.** Confirmed via
  `Glob`/`Grep`/`git log --all` across every local and remote branch: there is no
  `eas.json`, no `.eas/workflows/` directory, no file matching "Android Production Build
  & Deploy" anywhere in history, and no "preview" EAS Workflow either, despite the issue
  saying preview "already covers" the same conditional-skip pattern. `package.json` has
  no `eas-cli`, no `expo-updates`; `app.json` has no `runtimeVersion`, no `updates` block,
  no `extra.eas.projectId`. The only CI file present, `.github/workflows/ci.yml`, runs
  lint/typecheck/test — unrelated to EAS Build or EAS Update. Confirmed with the user:
  there is also no EAS project yet on expo.dev (no `eas init` has been run). This spec
  therefore designs the full pipeline from scratch — `eas.json`, `expo-updates`, EAS
  project initialization, and the production workflow — rather than diffing an existing
  file, per the user's explicit direction after this gap was surfaced. No preview/staging
  workflow is introduced here: issue #43 explicitly excludes touching staging, so
  `production.yml`'s fingerprint → get-build → conditional-build shape is specified in
  full below rather than by reference to a preview file that doesn't exist.
- **Current code:** No `.eas/` directory, no `eas.json`, no EAS Workflow YAML anywhere.
  `app.json`'s only current concerns are the app identity, Android permissions, and the
  `react-native-ble-plx` plugin (see `docs/specs/android-ble-permission-gate/SPEC.md`).
  `package.json` scripts are all local (`expo start`, `expo run:android`, `jest`, etc.) —
  nothing invokes `eas` today. `CLAUDE.md`'s milestone tech-stack lists (Milestone 1/2/3)
  do not mention `eas-cli`, `expo-updates`, or EAS Workflows at all; this is CI/deploy
  tooling requested directly via issue #43, not product scope tracked in
  `docs/specs.md`. That silence is a real gap in `CLAUDE.md`, flagged in Constraints
  below, but this spec does not edit `CLAUDE.md` — no prior spec in this repo treats
  `CLAUDE.md` as a deliverable file, and the milestone list is process documentation the
  project owner curates directly.
- **User impact:** Maintainer-facing only — nobody outside this repo's maintainer
  merges to `main` or dispatches this workflow. Today, every manual production dispatch
  pays for a full Android native build (minutes, EAS build-minutes budget) even when only
  JS/asset code changed since the last production build. After this change, the workflow
  also fires automatically on every merge to `main` (in addition to manual dispatch), and
  a JS-only change since the last production build publishes near-instantly over EAS
  Update to installs on the `production` channel instead of waiting on a native build; a
  native-affecting change still gets a full build, automatically detected rather than
  manually judged. This means every merge to `main` now ships to production automatically
  — there is no longer a deliberate gate between "code merged" and "production updated."
- **Dependencies:**
  - `eas-cli` (global or `npx`, not a `package.json` dependency — EAS Workflows execute
    on Expo's infrastructure, not locally, so no local runtime dependency is required
    beyond what generates `eas.json`/`app.json` config).
  - `expo-updates` (new dependency, installed via `npx expo install expo-updates` to
    resolve the SDK-56-compatible version, per `CLAUDE.md`'s pinning rule) — required for
    any build to be able to _receive_ an EAS Update at all; without it, the
    `publish_android_update` job would publish updates no installed build can fetch.
  - An EAS project must exist (`eas init` or `eas update:configure`, run once against the
    Expo account this repo already deploys under) before either workflow file is
    meaningful — `eas.json`/`app.json`'s `extra.eas.projectId` needs a real project ID.
    This is an account-level action outside version control; Implementation Steps calls
    it out as a manual pre-req, not a step this spec's files perform.
  - `pnpm` is the package manager per `CLAUDE.md`; `npx expo install expo-updates` still
    installs through the project's configured package manager.

## Data Model

N/A — this is CI/deploy configuration (YAML workflow definitions, `eas.json`, and
`app.json` fields). No TypeScript types, no persisted or in-app data model changes.

## Interfaces / API

All "interfaces" here are EAS Workflow job graphs (YAML, not code) and the `eas.json` /
`app.json` config contracts those jobs read. Job types, params, and outputs below are
per the EAS Workflows syntax reference
(`https://docs.expo.dev/eas/workflows/syntax/`) and EAS Update guide
(`https://docs.expo.dev/eas-update/getting-started/`), read for this spec per `AGENTS.md`.

### `.eas/workflows/production.yml`

Trigger: `push: branches: ['main']` and `workflow_dispatch: {}`. The issue's proposed
workflow was manual-dispatch-only, but this was revised during implementation: every
merge to `main` now auto-triggers the fingerprint → get-build → conditional
build/update pipeline, with `workflow_dispatch` kept alongside it for an on-demand
re-run (e.g. retrying a failed dispatch without a new commit). This means production
builds/OTA updates ship automatically on merge to `main`, not only on a deliberate
manual action — a real behavior change from the issue's original design, accepted
here per explicit user direction.

Job graph, in dependency order:

1. **`fingerprint`** (`type: fingerprint`, `environment: production`) — computes the
   project's native fingerprint. Output consumed downstream:
   `outputs.android_fingerprint_hash`.
2. **`get_android_build`** (`type: get-build`, `needs: [fingerprint]`) — looks up an
   existing production build matching the fingerprint.
   - `params.fingerprint_hash: ${{ needs.fingerprint.outputs.android_fingerprint_hash }}`
   - `params.profile: production`
   - `params.platform: android`
   - Output consumed downstream: `outputs.build_id` (empty/falsy when no match exists).
3. **`build_android_production`** (`type: build`, `needs: [get_android_build]`) —
   unchanged native-build job, now conditional:
   - `if: ${{ !needs.get_android_build.outputs.build_id }}`
   - `params.platform: android`, `params.profile: production` (unchanged from today's
     described-but-nonexistent job).
4. **`publish_android_update`** (`type: update`, `needs: [get_android_build]`) — new job,
   runs only when a matching build was found:
   - `if: ${{ needs.get_android_build.outputs.build_id }}`
   - `params.branch: production`, `params.platform: android`.
   - This job does not depend on `build_android_production` — the two are mutually
     exclusive via their `if:` conditions on the same upstream output, not sequenced
     against each other. Exactly one of the two runs per dispatch.

This matches the issue's proposed YAML exactly; nothing above is new design beyond
wiring it to config that must now also be created.

No preview/staging workflow is created alongside it — issue #43 explicitly scopes this
work to production ("do not touch or introduce a staging workflow"). The job graph
above is the same fingerprint → get-build → conditional-build/update shape the issue
says preview already uses; this spec doesn't need a real preview file to exist for that
comparison to be meaningful, since the full shape is specified directly above rather than
by reference.

### `eas.json`

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "distribution": "internal",
      "channel": "production",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

- `cli.version` pin: verify the current `eas-cli` major during implementation (the
  version above is a placeholder floor, not a verified pin — confirm against
  `npx eas-cli --version` or the EAS Workflows changelog before merging).
- `distribution: "internal"` / `buildType: "apk"` on the production profile: this project is not
  currently distributed through the Play Store (no store-listing work exists anywhere in
  this repo or `docs/specs.md`) — an internal, sideloadable APK matches the issue's own
  job name ("Build Android Production APK") and the project's current single-maintainer
  distribution model. **Flagged for confirmation before merge**, not silently assumed:
  if store distribution is intended for "production" later, `buildType` becomes
  `app-bundle` and `distribution` becomes `store`, which also changes how the build is
  installed/updated in practice.
- The profile's `channel` is what makes the fingerprint/get-build/update pattern
  meaningful: a build's `channel` is baked in at build time and determines which EAS
  Update branch/channel it polls for OTA updates — `production` builds only ever receive
  updates published with `--channel production` (i.e., the `publish_android_update` job's
  `branch: production`).
- No `development` profile — this project's dev-client builds are produced locally via
  `pnpm android` (`expo run:android`) per `CLAUDE.md`, not through EAS Build; there is no
  CI/local use case yet that needs an EAS-hosted development profile.

### `app.json` additions (`expo` key)

```json
{
  "runtimeVersion": { "policy": "fingerprint" },
  "updates": {
    "url": "<eas update:configure fills this in>"
  },
  "extra": {
    "eas": { "projectId": "<eas init fills this in>" }
  }
}
```

- `runtimeVersion.policy: "fingerprint"` is required, not optional, for this pattern:
  the `fingerprint`/`get-build` jobs and EAS Update's own compatibility check both key
  off the native fingerprint. Any other policy (`sdkVersion`, `appVersion`) would let a
  native-incompatible JS update reach an install, defeating the reason this issue exists.
- `updates.url` and `extra.eas.projectId` are generated by `eas update:configure` / an
  EAS project's existence — not hand-authored. Implementation Steps below runs these
  commands rather than hand-writing placeholder values.

## Files Created

| File                            | Purpose                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `eas.json`                      | `production` build profile with `channel` wiring for EAS Update.                    |
| `.eas/workflows/production.yml` | Fingerprint → get-build → conditional build/publish-update pipeline for production. |

## Files Modified

| File           | Change                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `package.json` | Add `expo-updates` to `dependencies` via `npx expo install expo-updates` (version resolved by the installer, not hand-picked).                                                       |
| `app.json`     | Add `expo.runtimeVersion` (`fingerprint` policy), `expo.updates.url`, `expo.extra.eas.projectId` — the latter two populated by `eas update:configure`/`eas init`, not typed by hand. |

## Implementation Steps

1. **Manual pre-req, outside version control:** run `eas init` (or confirm an EAS
   project already exists for this Expo account) so a real `projectId` exists to wire
   into `app.json`. Do this before any file below is written with real values.
2. `npx expo install expo-updates` — adds the dependency and applies any SDK-56-specific
   config the installer performs automatically.
3. `eas update:configure` — writes `expo.runtimeVersion`, `expo.updates.url`, and
   `expo.extra.eas.projectId` into `app.json`. Verify the emitted `runtimeVersion` is (or
   is changed to) `{ "policy": "fingerprint" }` — the default the command chooses may
   differ and needs confirming against the contract above.
4. Author `eas.json` per the Interfaces section, pinning `cli.version` to the actually
   installed `eas-cli` version rather than the placeholder floor above.
5. Author `.eas/workflows/production.yml` per the Interfaces section.
6. Manually trigger the workflow from the EAS dashboard (`workflow_dispatch` has no
   CLI/local equivalent to test against — this is not something `pnpm test` can cover)
   and confirm:
   - A first-ever dispatch (no prior build for that fingerprint) runs `build`, not
     `update`.
   - A second dispatch with no native change since finds the prior build via
     `get-build` and runs `publish_android_update`, not another native build.
   - A dispatch after a deliberately-introduced native change (e.g. touching `app.json`'s
     `android.permissions`) produces a new `android_fingerprint_hash` and forces a
     rebuild again.
7. No `pnpm test`/`pnpm typecheck`/`pnpm lint` coverage applies to YAML workflow files or
   `eas.json` — this repo's test suite covers TypeScript source under `src/`, not CI/CD
   config. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` anyway after this change to
   confirm the `expo-updates` dependency install didn't regress anything already covered
   (e.g. Metro/type resolution).

## Style & Conventions

- Workflow YAML uses the job-graph shape from the issue's own proposed fix verbatim for
  `production.yml` — no re-design of that pipeline, only the missing config it depends
  on is being added.
- `eas.json`/`app.json` changes are native/build config, not application code — they
  don't interact with the `app/ → components/ → hooks/ → services/ → interfaces/`
  layering contract in `CLAUDE.md` at all.
- Per `CLAUDE.md`'s "Android only" non-negotiable: no `ios` block, no iOS platform
  param, in the workflow file or `eas.json`. `production.yml` omits any `ios`-typed job.
- Per `CLAUDE.md`'s "no custom backend" non-negotiable: EAS Build/Update is Expo's
  managed service, not a custom backend the project would own/operate — consistent with
  the spec's constraint set, not a new exception to it.
- Package install goes through `npx expo install expo-updates`, not a hand-picked
  version in `package.json`, per `CLAUDE.md`'s pinning rule for Expo-managed packages.

## Acceptance Criteria

- [ ] `eas.json` exists with a `production` build profile whose `channel` matches the
      profile name.
- [ ] `app.json` has `runtimeVersion.policy === "fingerprint"`, a real `updates.url`, and
      a real `extra.eas.projectId` (not placeholder text).
- [ ] `expo-updates` appears in `package.json` `dependencies` at the version
      `npx expo install` resolves for SDK 56.
- [ ] `.eas/workflows/production.yml` runs `fingerprint` → `get_android_build` →
      exactly one of `build_android_production` / `publish_android_update`, never both,
      never neither, on a single `workflow_dispatch`.
- [ ] A production dispatch with no native change since the last production build
      publishes an EAS Update to the `production` branch/channel instead of building.
- [ ] A production dispatch after a native-affecting change (fingerprint hash differs)
      runs a full build instead of an update.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` all still pass after the
      `expo-updates` install.

## Constraints

- **Android only** — no iOS job, platform param, or `eas.json` iOS build profile field,
  per `CLAUDE.md`, even though EAS Workflows/`eas.json` support iOS generally.
- **Production only — no staging/preview workflow is created.** Per issue #43's
  explicit "do not touch or introduce a staging workflow" note, this spec adds only
  `.eas/workflows/production.yml` and its supporting `eas.json`/`app.json` config. No
  `preview` build profile, no `.eas/workflows/preview.yml`.
- **Distribution model assumption flagged, not settled:** `buildType: apk` /
  `distribution: internal` on the `production` profile assumes this app is sideloaded,
  not Play-Store-distributed. If that's wrong, `eas.json`'s production profile and the
  practical meaning of "install already has a matching build" both change — confirm
  before merging, don't silently ship the assumption.
- **`cli.version` in `eas.json` is a placeholder floor**, not a verified pin — confirm
  against the actually-installed `eas-cli` before merge.
- **EAS project creation (`eas init`) is a manual, account-level pre-req** this spec's
  files cannot perform — it must happen before `app.json`'s `projectId` can be real.
- **`CLAUDE.md`'s milestone tech-stack lists don't mention `eas-cli`/`expo-updates`/EAS
  Workflows anywhere** (Milestone 1, 2, or 3) — this is infrastructure/CI tooling
  requested directly via issue #43, outside `docs/specs.md`'s product scope. Flagged
  here rather than silently ignored; updating `CLAUDE.md`'s tech-stack narrative is the
  project owner's call and out of scope for this spec's file list.
- **No test-suite coverage for the new YAML/`eas.json` files** — `jest-expo` covers
  TypeScript under `src/`, not CI/CD configuration; verification for this issue is the
  manual dispatch sequence in Implementation Steps, not `pnpm test`.
