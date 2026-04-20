# Contributing to PushUpHero

Thanks for working on PushUpHero! This file documents our git + ticketing workflow so every change is traceable from Linear → branch → commit → PR → merged state.

## Tickets live in Linear

All work — features, bugs, chores, tech debt — is tracked on [Linear](https://linear.app/pushuphero) under the **PushUpHero** team (key `PUS`). GitHub Issues is not used for planning.

When you pick something up, move the ticket to **In Progress** so the team knows it's being worked on.

## Branch naming

Every branch maps to exactly one Linear ticket. Use the Linear-suggested branch name verbatim:

```
feature/<issueIdentifier>-<issueSlug>
```

Example — ticket `PUS-9 Resume interrupted workout via localStorage checkpoint`:

```
feature/pus-9-resume-interrupted-workout-via-localstorage-checkpoint
```

Linear exposes this as the "Copy git branch name" button on every issue. Don't invent your own format — the prefix/format is configured workspace-wide in Linear settings so every branch is consistent.

## Commit convention

Conventional Commits only:

- `feat:` — user-facing new behavior
- `fix:` — bug fix
- `refactor:` — code change without behavior change
- `chore:` — tooling, config, deps
- `docs:` — documentation only
- `revert:` — undo a previous commit

**Don't tag `PUS-N` in commit messages.** The PR title and body handle the link to Linear. Commit messages stay focused on what changed.

Keep commits logically scoped — one feature per commit where practical, and never mix unrelated changes.

## Pull requests

**Title**: `[PUS-N] Short description`

Example: `[PUS-9] Resume interrupted workout via localStorage checkpoint`

**Body** (use this as your template):

```markdown
## Summary
- Bullet point of what changed
- Another bullet
- Another bullet

Resolves [PUS-N](https://linear.app/pushuphero/issue/PUS-N)

## Test plan
- [ ] Step to verify happy path
- [ ] Step to verify edge case
- [ ] Step to verify no regression in adjacent area
```

The `Resolves PUS-N` phrase (or `Closes PUS-N` / `Fixes PUS-N`) is picked up by the Linear ↔ GitHub integration and auto-moves the ticket to **Done** when the PR is merged.

## Merging

- PRs go to `main`.
- Squash-merge or merge-commit — either is fine; we'll standardize once we have more contributors.
- Delete the branch after merge.

## Linear ↔ GitHub integration

The integration must be set up once at the workspace level:

1. https://linear.app/pushuphero/settings/integrations/github
2. Install the Linear GitHub App on `Luchiwa/PushUpHero`
3. Enable "Update issue status on PR state"

Once connected, opening a PR attaches it to the referenced Linear issue, and merging it closes the issue automatically.
