---
name: code-simplify
description: |
  Reviews changed code for reuse, simplification, efficiency, altitude (root-cause depth) and
  comment problems, then applies the fixes without changing behavior. Fans the five angles out to
  parallel subagents when the agent has a subagent tool, otherwise works through them inline in one
  pass. Use when the user says "simplify", "clean up this diff", "tidy the changes before I commit",
  "精简一下改动", "清理这次的代码", "review for duplication / over-engineering", or right after
  finishing a feature. Accepts an optional target: a PR number, branch, commit range or path.
  Quality only: it does not hunt for correctness bugs; use a code-review skill for that. For a
  sweep of every comment and doc in a project use comment-doc-cleanup.
---

# Code simplify

Improve the quality of the changed code, not hunt for bugs. Review it for reuse, simplification, efficiency, altitude and comment problems, then fix what you find. Correctness bugs are out of scope; mention any you happen to see in the summary instead of fixing them.

## Phase 0: gather the diff

If the user named a target, review that instead of the default:

- PR number: `gh pr diff <n>`
- branch or range: `git diff <base>...<branch>` / `git diff <range>`
- file or directory: the default diff below, restricted to that path

Otherwise, run `git diff @{upstream}...HEAD`. With no upstream, use `git diff <default-branch>...HEAD` (`git symbolic-ref refs/remotes/origin/HEAD` names it), or `git diff HEAD~1` when the base can't be told. Uncommitted changes count too: this often runs before the commit, so also run `git diff HEAD` and include the working-tree changes. Treat the combined diff as the review scope.

Read the project's instruction files (AGENTS.md, CLAUDE.md, CONTRIBUTING) once: fixes in Phase 2 follow their conventions, including the comment language and doc-comment style.

## Phase 1: review (5 angles)

**With a subagent tool** (Claude Code `Agent`/`Task`, Codex subagents, …): launch 5 independent review agents in a single message so they run concurrently. Give each the diff and exactly one angle below, and tell it to report only, not edit.

**Without one:** work through all five angles yourself, one after another, in one pass. Do not skip an angle for lack of fan-out.

Each finding carries `file`, `line`, a one-line `summary`, and the concrete cost: what is duplicated, wasted, harder to maintain, or misleading.

### Reuse

Flag new code that re-implements something the codebase already has. Grep shared/utility modules and files adjacent to the change, and name the existing helper to call instead.

### Simplification

Flag unnecessary complexity the diff adds: redundant or derivable state, copy-paste with slight variation, deep nesting, dead code left behind. Name the simpler form that does the same job.

### Efficiency

Flag wasted work the diff introduces: redundant computation or repeated I/O, independent operations run sequentially, blocking work added to startup or hot paths. Also flag long-lived objects built from closures or captured environments: they keep the entire enclosing scope alive for the object's lifetime (a memory leak when that scope holds large values); prefer a class/struct that copies only the fields it needs. Name the cheaper alternative.

### Altitude

Check that each change fixes the root cause at the right depth rather than patching a symptom with a fragile bandaid. Special cases layered on shared infrastructure are a sign the fix isn't deep enough: prefer the simpler, more general change to the underlying mechanism over adding special cases, and name that change.

### Comments

Scope: comments and docstrings the diff adds or edits, plus existing ones attached to code the diff changed. Every other comment, and all standalone documentation, stays as it is.

Ask of each sentence: if it were deleted, what would a reader who knows the language and can see the identifiers lose? Nothing: flag it for deletion. A fact wrapped in filler: flag it and give the shorter wording.

- Delete: a restatement of the code or of the identifier's name (`// loop over users`, `Gets the user.` on `getUser()`); change narration (`// fixed bug where…`, `// added null check`); a task, plan or review label (`Task 5`, `step 3`, `per review`), keeping the fact it pointed at; section banners; empty docblocks.
- Rewrite: empty adjectives ("robust", "gracefully handles") into the concrete fact; a prohibition into the precondition ("Requires init() to have run: reads the config it loads").
- Stale: an existing comment that the changed code now contradicts (a renamed function, a changed default, a removed branch). Give the corrected fact.
- Keep: a comment that says why (a constraint, a trade-off, a workaround with its link, an invariant not visible locally); a comment a tool reads (`//nolint`, `# type: ignore`, `@ts-expect-error`, `//go:generate`, license headers); a doc comment lint requires, which gets one specific sentence instead of deletion.

## Phase 2: apply the fixes

Wait for all five angles to finish. Dedup findings that point at the same line or mechanism, then fix each remaining one directly: code findings first, comment findings after, since a code fix can make the comment beside it wrong. After the code fixes, reread the comments attached to every line they touched and correct or delete the ones that no longer hold.

Skip a finding when its fix would change intended behavior, require changes well outside the reviewed diff, or when you judge it a false positive. Note the skip with a reason rather than arguing with it.

After editing, run the project's fast checks that cover the touched files (formatter, linter, type check, the relevant tests). A fix that breaks them is reverted and listed as skipped.

Finish with a brief summary:

- what was fixed, as `file:line` + one line each
- what was skipped and why
- or a plain statement that the code was already clean

If the review ran inline without subagents, say so in the summary, so whoever reads it knows a single pass ran, not the 5-agent fan-out.
