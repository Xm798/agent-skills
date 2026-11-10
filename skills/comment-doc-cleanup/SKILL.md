---
name: comment-doc-cleanup
description: |
  Sweeps a whole project (or a given directory) for low-value comments, docstrings, README and doc
  prose: deletes comments that restate the code or say only what the name already says, boilerplate,
  empty adjectives, closing summaries and placeholders that will never be done, and rewrites what is
  left into specific wording, so comments and docs get shorter and more concrete without losing a
  fact. Use when the user says "clean up comments", "comments are too verbose", "remove the
  slop/boilerplate", "the docs read like AI", "清理注释", "排查注释和文档", "注释太啰嗦", "去掉废话/套话",
  "文档像 AI 写的", or asks for a pass over every comment or doc in the repo. Edits comments and prose
  only, never logic. For duplicated code, dead code or over-abstraction use ai-slop-cleaner; for the
  tone of one essay or post use no-ai-slop or humanizer-zh.
---

# Comment & doc cleanup

Squeeze the water out of a project's comments and docs: the result is shorter and more specific, and loses no fact.

This is editing, not refactoring. Touch comments, docstrings and documentation only; code stays line for line as it was. A code problem spotted on the way goes into the final report, not into the diff.

Copy this checklist into the reply and tick items as they are done:

```
- [ ] 1. Scope: read the project's conventions and lint config
- [ ] 2. Judge each sentence: delete / rewrite / keep; verify every kept fact against the code
- [ ] 3. Build, lint, test; fix until green
- [ ] 4. Prove the diff is comment-only (comment-stripped AST compare)
- [ ] 5. Report results only
```

## 1. Scope

- Default to the whole project; when the user names a directory or file type, stay inside it. `rg --files` to see what is there, then scan in batches: comments (`rg -n "^\s*(//|#|/\*|\*|--)"`, adjusted per language), docstrings, `*.md`, `*.txt`, `description` fields in OpenAPI or JSON Schema.
- Read CLAUDE.md, CONTRIBUTING and the lint config (`.golangci.yml`, `eslint.config.*`, `pyproject.toml`, …) first. They tell you the project's comment conventions (language, docstring style) and which comments lint demands (Go doc comments on exported identifiers, `revive`/`stylecheck` package comments). Deleting one of those turns CI red.
- Settle the language rule with the user before editing: the default is "keep each comment's language, bilingual stays bilingual"; a project may want test comments in English only. Product, bank and feature names are data in any language and stay as written.
- In a large project work one directory at a time and check the diff before moving on. With several agents, partition by comment density, give each the same rules and a package-scoped verification, and run one whole-tree verification at the end. Measure progress in comment blocks or characters: line counts lie when a rewrite wraps differently or a translation is longer.

## 2. Judge each sentence

Ask one question of every sentence, not just every comment: **if this sentence were deleted, what would a reader who knows the language and can see the identifiers lose?** Nothing: delete it. One fact: write that fact shorter and more specifically. After the rewrite ask again; the answer still has to be "nothing". A comment with two independent facts keeps two sentences; length is never the criterion.

Every kept fact is checked against the code it describes. Comments drift: a renamed function, a changed default, an identity that is now the user id rather than the email. Fix the fact, and list the correction in the report; a cleanup that leaves a wrong comment shorter has made it worse.

### Delete

| Type | Example | Action |
|---|---|---|
| Restates the code | `// set x to 1` above `x = 1`; `// loop over users` above `for u in users`; a docblock reciting parameter names and the return type; a value, state name or list the next lines show | Delete |
| Obvious from the name | `// Validate input` above `validateInput(x)`; `// Handle error` above an `if err != nil`; `// Constructor`; `// Helper functions`; `Gets the user.` on `getUser()` | Delete. It says nothing the identifier does not already say |
| Narrates the change | `// modified to handle nil`, `// fixed bug where…`, `// added per review`, `// step 2 of the plan` | Delete. That is commit-message or conversation content; a reader a year later cannot follow it |
| Review and plan labels | `Task 5`, `M-4`, `C1`, `裁决 3`, `审查发现 2`, `Plan 7a §3`, `spec §4.2`, `design doc §6`, `/simplify` | Delete the label, keep the fact. A label that resolves to a local or gitignored document is still unreachable for every other reader, so it is never re-qualified into `Plan 7a 裁决 3`; the fact it pointed at is written out instead |
| Defends the road not taken | `内容与状态无须回读：发布成功即库里是这份内容`, "we could have cached this but the list is short" | Delete. When the alternative is tempting and wrong in a way the code cannot show, keep the one clause that says why it is wrong |
| Re-expands a consequence | A second sentence spelling out what the first already implies: `回读会对本次的作者报出别人的修订` after `提交后回读可能拿到另一位维护者随后发布的那一版` | Delete the second sentence |
| Design-process residue | `书面接受的窗口`, `最佳实践`, `这样更清晰`, who decided, what was discussed | Delete the words; keep the constraint they wrapped |
| Emphasis and hedging | `缺一不可`, `务必`, `必须注意`, `重要`, "it is crucial that" | Delete. A stated constraint carries its own weight |
| Boilerplate | "In today's fast-paced world…", "This file contains…", "本模块负责…的相关功能" | Delete the paragraph |
| Empty adjectives | "robust, scalable, cutting-edge", "强大灵活的", "gracefully handles" | Replace with the concrete fact (what it does, its limit, the number); no fact, delete |
| Closing summary | A doc ending that repeats the body; "In conclusion…"; "综上所述" | Delete; keep the conclusion itself only if the body never stated it |
| Dead placeholder | A `TODO` with no owner, no ticket, or whose work the code already does; `pass`, `// ...`, "TBD" | Delete; real unfinished work gets done or becomes one line with an issue link |
| Section banner | `// ===== Section =====`, `// ---- helpers ----`, `/* --- Surfaces --- */` | Delete; a function long enough to need sections is a separate finding for the report |
| Empty docblock | `/** @param x @return */`, a docstring that is only `"""."""`, generated `# TODO: docstring` | Delete |

### Rewrite

Brevity is in service of precision, not the other way round.

- A real fact wrapped in filler: strip the filler, keep the fact. "This robust function efficiently handles all edge cases of date parsing" becomes what it actually does: "Accepts ISO 8601 and the bank's `YYYY/MM/DD` export format; anything else returns ErrBadDate."
- "What" into "why": drop the part the code shows, state the part it cannot.
- Prohibition into precondition: "don't call before init, otherwise it breaks" becomes "Requires init() to have run: reads the config it loads."
- Written register, conclusion first. A comment is a maintainer's note, not a spoken explanation: declarative sentences, things named by identifier or domain term, the conclusion before the reason. Spoken verbs and metaphors (`兜底`, `撞上`, `绑着墓碑`, `停在`, "the whole point of", "load-bearing"), rhetorical closers (`只有这个键说得出来`), "we/our", and sentence-final particles become plain statements. Corner brackets `「」` mark literal UI copy or values, never emphasis. A reference to another comment (`见 X 的注释`) names the function or type instead, or states the fact.
- In doc prose, one claim per paragraph plus the facts that support it. Vague attribution ("it is widely known", "业内普遍认为") gets a concrete source or goes.
- Two independent facts do not get squeezed into one sentence, and an accurate long sentence is not traded for a vague short one. Readability and accuracy outrank word count.

### Keep

Deleting the wrong comment costs more than leaving an extra one. Keep these even when they look short or odd:

- **Comments that explain why**: a non-obvious constraint, a deliberate trade-off, a workaround for an external bug (with link), an invariant not visible locally, an ordering or concurrency assumption, a race the code cannot show.
- **Durable references**: `ADR-0012`, `RFC 8291`, a CVE, an issue URL, a file the repo ships (`CONTEXT.md`). Durable means resolvable from the repository or the public internet; a design document outside the repo is not (see "Review and plan labels").
- **Comments a tool reads**: `//go:generate`, `//go:embed`, `//nolint`, `// @vitest-environment jsdom`, `// eslint-disable-*`, `# type: ignore`, `# noqa`, `@ts-expect-error`, shebangs, license headers, JSDoc types TypeScript consumes. Breaking one changes the build. The reason text after a directive (`//nolint:errcheck // Close on a read-only file`) is a why and stays too.
- **Doc comments lint requires**: do not delete; replace a `// Foo is the Foo.` with one specific sentence.
- **User-facing copy**: locale files, error messages, CLI help, MCP tool descriptions, OpenAPI descriptions. That is product, out of scope.
- **Strings in code**: test names, assertion messages, fixture data. They are code even when they contain an old label.

When unsure, leave it and list it in the report for the user to decide.

### Doc comments on declarations

Where lint does not require a doc comment, judge it with the cover test: cover the comment, read the identifier, signature, receiver and field names, and write down what you expect the thing to do. A comment that adds nothing to that is deleted even when it is phrased specifically (`// ListBanks returns the tenant's banks ordered by name.` on `ListBanks(ctx, scope) ([]Bank, error)` whose body shows the ORDER BY). A comment survives when it carries an invariant, a precondition, a unit or encoding, a nullability or empty-means rule, an ordering callers rely on, a frozen-contract rule, a concurrency or lifetime rule, or a durable reference; words like "must", "never", "only", "before", "after", "shared" usually mark one. A restating first sentence in front of a real second one is dropped so the comment starts with the fact. In a mature tree expect roughly a quarter of exported doc comments to fail the cover test; a pass that removes a few percent has been reading the comment instead of covering it.

### Test files

The test name is the documentation. A test comment survives only when it states something about the test's own mechanics that the code cannot show: why a fixture or mock is shaped as it is, a shared database needing globally unique ids, a frozen vector being append-only, a timing constant that must stay below another for the assertion to mean anything, a jsdom or framework limitation (with link), a regression guard naming the bug it prevents, or a durable reference the assertion enforces. A comment that explains how the product behaves belongs in the production code next to that behaviour and is deleted here; the title plus the assertion already state the expectation. Step narration, banners and `TestX does…` docblocks go.

## 3. Verify

Run the project's own checks: build, lint, tests, and the docs build if there is one. Comment edits can turn CI red too: a lint-required doc comment removed, a directive comment broken, a Markdown code fence damaged. Fix and rerun until green before going on.

## 4. Prove the diff is comment-only

`git diff --stat` confirms the change is confined to the agreed scope. Then prove the code is unchanged by comparing each modified file against HEAD with comments stripped: for Go, parse both versions with `go/parser` (comments dropped), print with `go/printer` and compare after collapsing whitespace, since removing a trailing comment realigns neighbours; for TS/JS, `ts.createSourceFile` plus `ts.createPrinter({ removeComments: true })`; for CSS, HTML and shell, strip the comment syntax and diff. Any remaining difference is a code change to revert. Edit with the editor tool rather than stream editors: BSD `sed` reads `\t` as a literal `t` and clips words. Do not commit unless asked; when asked, stage the cleanup's files by explicit path so a colleague's parallel work in the same tree stays out of the commit.

## 5. Report

Results only, no process. Never "I first scanned… then decided…". Drop a section that has nothing in it.

```
## Cleanup
- Scope: N files (one or two lines by directory or type)
- Deleted: restating / labels / narration / placeholders, counts only where they change a decision
- Rewritten: N, with 1–2 before/after pairs
- Corrected against the code: `path/file.go:123` what the comment claimed, what the code does

## Left for you to decide
- `path/file.go:123` one line on why it is unclear

## Noticed, not changed
- Code-level problems, one per line, with file:line
```

## Examples

**Design process → one fact**

```go
// 响应的修订号取自事务本身而非提交后回读：两者之间另一个维护者可能再发
// 一版，回读会对本次的作者报出别人的修订。内容与状态无须回读：发布成功即
// 库里是这份内容、状态 active（新建、改版、复活都写 active）。
```
→
```go
// 修订号取自本事务：提交后回读可能拿到另一位维护者随后发布的那一版。
```
The race stays; the re-expanded consequence, the defence of not rereading, and the state value the code writes two lines down go.

**Spoken register → written**

```go
// Status 单独一个键而不靠 pinned<current 推：…有书面接受的窗口（applyProduct 的状态门注释），
// 窗口里绑成的卡停在「绑着墓碑」上，只有这个键说得出来。
```
→
```go
// Status 独立存储，不由 pinned<current 推导：applyProductTo 的状态检查与 Removal 的下架事务之间
// 存在窗口，该窗口内建立的引用 pinned==current，而目标已是 Removed。
```

**Plan label → fact**

```go
// 硬约束（Plan 7a 审查发现 3）：staleFiringGrace 必须大于 deliveryTimeout。
```
→
```go
// staleFiringGrace 必须大于 deliveryTimeout，否则慢发送被回收后会二次投递。
```

**Empty adjective → fact**

```ts
// Robust helper that gracefully handles all currency formatting needs.
export function formatMinor(amount: number, currency: string): string
```
→
```ts
// Minor units (cents, fen) in, locale string out. JPY and KRW have no minor unit, so the divisor comes from the Intl data rather than a fixed 100.
export function formatMinor(amount: number, currency: string): string
```

**Change narration → why**

```go
// Changed in review: we now check the scope first to avoid the cross-tenant bug from before.
if err := scope.Validate(); err != nil {
```
→
```go
// Every query below trusts scope.UserID, so an invalid Scope must fail here and nowhere later.
if err := scope.Validate(); err != nil {
```

**Test comment → test mechanics only**

```ts
// 首屏请求数与卡数无关：逐卡 getCycle 会触发每租户限流（240/min、突发 60）。
```
→
```ts
// Guards against one getCycle per card.
```

**Obvious from the name → delete**

```python
def get_user(user_id: str) -> User:
    """Gets the user by id."""
```
→
```python
def get_user(user_id: str) -> User:
```
