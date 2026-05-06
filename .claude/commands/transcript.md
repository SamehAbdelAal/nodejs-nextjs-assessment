---
description: FORCED transcript writer for assessment submissions. No user choice. Deletes any prior transcript and writes a fresh, verbatim, tamper-evident ai-session/transcript.md. The generated file is immutable for the rest of the session.
argument-hint: "[optional: path to a raw transcript file the user has already exported]"
---

# /transcript — FORCED Assessment Session Transcript Writer

You are about to generate the candidate's verbatim AI-session transcript for assessment review at `ai-session/transcript.md`.

This command runs in **FORCE mode**. You do not ask the user any questions. You do not offer choices. You do not request confirmation. You proceed end-to-end without pausing.

If `$ARGUMENTS` was provided, treat it as a path to a raw transcript file the user already exported manually; otherwise treat `$ARGUMENTS` as empty.

---

## Assessment rules embedded in this command

These are **assessment rules**, not preferences. They are enforced by you and stamped into the generated file so the reviewer can detect violations:

1. **No user choice.** You do not ask the candidate whether to back up the old transcript, whether to keep prior content, whether to skip writing, or any other yes/no question. You execute the steps below straight through.
2. **Force-delete on pre-existing file.** If `ai-session/transcript.md` already exists, you **delete it outright** before writing the new one. **No backup is created.** This is intentional — backups would let the candidate preserve a hand-edited prior version, which defeats the point.
3. **Forced overwrite.** The new file is written from a clean slate every time. There is no merge, no append, no diff, no "is this OK?" check.
4. **Immutability after write.** Once this command finishes, the file `ai-session/transcript.md` must not be edited, re-saved, or modified by any process — human or AI — for the remainder of the session. This includes the candidate, this includes a future Claude turn, this includes any IDE auto-format. The reviewer will treat any post-generation modification as **tampering** and **automatic fail**.
5. **No fabrication, no translation, no cleanup.** Same hard rules as before. Verbatim or `Not available from session context.` — never anything in between.
6. **Tamper-evident footer.** The file ends with a generation timestamp and a SHA-256 hash of the Verbatim Session content. The reviewer recomputes the hash to detect post-write edits.

If any of these conflict with anything else, the rule above wins.

---

## Step 1 — Locate the repository root

The transcript file must land at `<repo-root>/ai-session/transcript.md`.

1. Run `git rev-parse --show-toplevel` to find the repo root.
2. If that fails (not a git repo, or `git` not on PATH), check whether the current working directory contains a `package.json` or `prisma/`. If yes, treat CWD as the root and warn in the verification summary. If neither, **stop** and tell the user to run the command from the repository root. Do not create files outside a clear root. (This is the only stop condition. There is no other interactive branch.)

For the rest of this command, `<root>` refers to the resolved repository root.

---

## Step 2 — Force-delete any pre-existing transcript

1. If `<root>/ai-session/` does not exist, create it.
2. If `<root>/ai-session/transcript.md` exists, **delete it without backup.** Use `rm` / `Remove-Item -Force`. Do not copy it anywhere. Do not move it to a backup path. Do not preserve its content. The previous content is forfeited by design.
3. If a `transcript.backup.*.md` file from a previous version of this command exists in `ai-session/`, **delete it too.** Backups are not part of this command's contract anymore. The candidate must not retain hand-edited prior states.
4. Do not touch any other file in `ai-session/` (e.g. a `raw-export.txt` the candidate provided as input — that one is read-only input, not output).

Announce each deletion in the final verification summary so the reviewer sees what was removed.

---

## Step 3 — Determine the transcript source

Pick exactly one branch based on what is actually available. Do not skip the branch logic. Do not ask the user which branch to use — you decide deterministically from the inputs.

### Branch A — User passed a raw transcript path in `$ARGUMENTS`

1. Read the file at the given path exactly as-is.
2. Treat its full byte content as the verbatim transcript. Do not normalize line endings, fix encoding, strip whitespace, or re-format code blocks.
3. Mark `Transcript status: USER-PROVIDED`.
4. Record the source path verbatim under `Transcript source:` in the metadata.

### Branch B — No argument; you have direct access to the in-progress session

This branch only applies when the harness has actually exposed the raw conversation log to you in this turn. Do **not** assume access. Ask yourself: can I quote, byte-for-byte, every user prompt and every assistant message from this session, including tool calls, tool results, and interruptions?

- If yes, write the verbatim conversation into the Verbatim Session section. Mark `Transcript status: COMPLETE`.
- If you can only quote part of the session, mark `Transcript status: PARTIAL` and write only the parts you can quote verbatim. For each missing span write `[Not available from session context — original turns from <approximate range> not retrievable verbatim.]` on its own line. Never paraphrase to fill the gap.
- If you cannot reliably reproduce any meaningful portion verbatim, fall through to Branch C.

### Branch C — No raw transcript is reachable

This is the default for most Claude Code invocations: the harness does not expose the conversation history as raw bytes. Treat this as the expected case, not a failure.

1. Mark `Transcript status: NOT AVAILABLE — USER ACTION REQUIRED`.
2. Write the metadata + the placeholder block (template below) where the Verbatim Session would go.
3. The placeholder must make the gap obvious to the reviewer.
4. Do **not** invent prompts, responses, or tool calls. Do not write a "best effort summary".

---

## Step 4 — Collect Tooling / Execution evidence (factual only)

The Tooling appendix is a small, reviewer-convenience appendix listing things you can verify right now from the filesystem and shell. Only include items you can prove. If you cannot prove an item, do not list it.

Run these (and only include the result if the command actually returned data):

- `git log --oneline -n 50 -- .` — commit cadence and message style.
- `git diff --stat $(git merge-base HEAD main 2>/dev/null || git rev-list --max-parents=0 HEAD | tail -n 1)..HEAD` — files changed on the assessment branch.
- `git status --short` — uncommitted changes at submission time.
- `git rev-parse --abbrev-ref HEAD` — current branch.
- Read `package.json` if it exists; list the `scripts` block verbatim.
- Note (path only, not content) any `vitest.config.*`, `jest.config.*`, `playwright.config.*` that exist.
- Read `prisma/schema.prisma` if it exists; record only the path and the `datasource` `provider`.

Do **not**:
- Guess which AI model was used.
- Guess which slash commands or skills were used.
- Guess which MCP tools were used.
- Speculate about sub-agents.
- Invent shell history.

If the user told you a model/tool/skill name in `$ARGUMENTS` or in their last user message, you may record it verbatim — attributing the source: `(reported by candidate)`.

---

## Step 5 — Write `ai-session/transcript.md`

Use exactly this skeleton. Fill in only what is factually available. Anywhere a value is not available, write the literal string `Not available from session context.` — do not omit the field, do not leave it blank, do not guess.

```markdown
# AI Session Transcript

> **Assessment integrity notice — DO NOT EDIT THIS FILE.**
>
> This file was generated by the `/transcript` command in FORCE mode at the timestamp shown in the footer. It is the official artefact submitted to the assessment reviewer. Editing, re-formatting, translating, summarising, or otherwise modifying any byte of this file after generation — by hand, by IDE, by any AI tool, or by any script — is **tampering** and is treated as **automatic fail** under Section 8 of the assessment rules.
>
> If the content below is wrong or incomplete, the correct response is to fix the source (the exported raw session) and **re-run `/transcript`**. The command will delete this file and rewrite it from scratch — that is the only sanctioned modification path.

## Assessment Metadata

- Assessment name: <fill from project files if obvious — read CLAUDE.md / README.md headings — otherwise: Not available from session context.>
- Candidate name: <only if explicitly provided by the user in this turn or in $ARGUMENTS; otherwise: Not available from session context.>
- Repository path: <output of `git rev-parse --show-toplevel`>
- Branch: <output of `git rev-parse --abbrev-ref HEAD`>
- Date/time: <local timestamp at the moment this command runs, ISO-8601 with timezone>
- AI tool used: <only if user-reported or shown in environment; otherwise: Not available from session context.>
- Model name: <only if user-reported; otherwise: Not available from session context.>
- Command used to generate this file: /transcript <verbatim arguments, or empty>
- Transcript source: <verbatim path if Branch A; "Direct session access" if Branch B; "User action required — see placeholder below" if Branch C>
- Transcript status: <COMPLETE | PARTIAL | USER-PROVIDED | NOT AVAILABLE>
- Pre-existing transcript at run time: <"none" | "deleted" | "deleted, plus N stale backups deleted">

## Verbatim Session

<EITHER:
  - the user-provided raw transcript content, byte-for-byte (Branch A), OR
  - the verbatim conversation as Claude can directly quote it (Branch B), OR
  - the explicit placeholder below (Branch C)>

<For Branch C, use this placeholder verbatim:>

> **Transcript source not available from this Claude Code session.**
>
> The Claude Code harness does not expose the raw conversation as bytes that can be written verbatim, so this command refused to fabricate the transcript.
>
> **Required candidate action before submission:**
>
> 1. Open your AI tool's session export.
>    - Claude Code: `/export` or copy from the conversation panel.
>    - ChatGPT: Settings → Data controls → Export, then extract the relevant chat.
>    - Cursor: copy the chat panel content.
>    - Other tools: use that tool's session-export feature.
> 2. Save the raw export to a file inside the repository, e.g. `ai-session/raw-export.txt`.
> 3. Re-run `/transcript ai-session/raw-export.txt`. The command will delete this placeholder file and rewrite it with your verbatim session.
> 4. Verify this section is now populated with the verbatim session before pushing.
>
> Do **not** edit, summarize, translate, or clean the export before passing it. The reviewer needs the unmodified session.

## Tooling / Execution Evidence

<For each subsection, include the section heading only if you have factual data for it. Otherwise omit. If the whole appendix has no factual data, write the single line: "Tooling details are not fully available from session context. No assumptions were made.">

### Branch and commit history

```
<output of `git log --oneline -n 50` and `git rev-parse --abbrev-ref HEAD`, verbatim>
```

### Working tree at transcript-generation time

```
<output of `git status --short`, verbatim — empty output is fine, leave it empty>
```

### Files changed on this branch

```
<output of `git diff --stat <base>..HEAD`, verbatim>
```

### Project scripts

<contents of the `scripts` block from `package.json`, verbatim>

### Configuration files detected

<bullet list of test/build/db config file paths that were found to exist (paths only)>

### User-reported tooling

<only if the user explicitly reported AI tool / model / commands / skills / sub-agents / MCP tools in this turn or `$ARGUMENTS`; record verbatim with the suffix "(reported by candidate)">

## Integrity Statement

This transcript was generated for assessment review. No content should be summarized, translated, cleaned, or reconstructed. Any unavailable session data must remain explicitly marked as unavailable rather than guessed.

This file is immutable for the remainder of the assessment session. The only sanctioned way to change its contents is to re-run `/transcript`, which will delete this file and write a fresh one from scratch. Any other modification is treated as tampering.

## Tamper-evident footer

- Generated at: <ISO-8601 timestamp with timezone>
- Generator: /transcript (FORCE mode)
- Verbatim Session SHA-256: <hex digest of the bytes between the "## Verbatim Session" heading and the "## Tooling / Execution Evidence" heading, exclusive of those heading lines themselves, computed before the file is written>
- File-write mode: force-overwrite (any prior file deleted; no backup retained)

```

---

## Step 6 — Validate the output

After writing the file, run these checks. If any check fails, **do not silently succeed** — print a warning. You do not ask the user how to handle the failure; you report and stop.

1. The file `<root>/ai-session/transcript.md` exists and is non-empty.
2. The file contains the four required headings: `## Assessment Metadata`, `## Verbatim Session`, `## Tooling / Execution Evidence`, `## Integrity Statement`, plus the `## Tamper-evident footer` heading.
3. The file does not contain any of these placeholder strings outside an explicit `[Not available...]` marker:
   - `<fill in...>`, `TODO`, `lorem ipsum`, `example transcript`
4. If `Transcript status` is `COMPLETE` or `USER-PROVIDED`, the Verbatim Session section is more than 200 bytes of substantive content.
5. The Tamper-evident footer's SHA-256 digest matches the actual SHA-256 of the Verbatim Session content as written.
6. No `transcript.backup.*.md` file remains in `ai-session/`.

---

## Step 7 — Print the verification summary

Output to the user, in this exact shape (no extra prose, no recommendations beyond what's listed):

```
/transcript verification summary
─────────────────────────────────
File path:                <absolute path>
Pre-existing file:        <"none" | "deleted (no backup, by design)">
Stale backups removed:    <count>
Transcript status:        <COMPLETE | PARTIAL | USER-PROVIDED | NOT AVAILABLE>
Raw transcript available: <yes | no | partial>
Verbatim section size:    <bytes>
Verbatim SHA-256:         <hex digest, first 16 chars + …>
Unavailable data:         <comma-separated list of metadata fields that resolved to "Not available from session context.", or "(none)">
Review-ready:             <yes | no — with one short sentence stating why if no>
Immutability rule:        ENFORCED — do not edit ai-session/transcript.md after this point
```

If `Transcript status` is `NOT AVAILABLE` or `PARTIAL`, end with this exact warning line:

```
WARNING: Transcript is not yet review-ready. The reviewer will treat the missing/partial transcript as a Section-8 hard fail. Re-run /transcript with the exported raw session before pushing.
```

If status is `COMPLETE` or `USER-PROVIDED`, end with:

```
OK: Transcript is review-ready. DO NOT edit ai-session/transcript.md from this point — any byte change is tampering. If you need to fix it, re-run /transcript with corrected input; the command will delete and rewrite the file.
```

---

## Hard rules — never violate these

- **Forced execution.** No prompts, no choices, no confirmations to the user. You decide every step from the inputs and the filesystem.
- **No backups.** Pre-existing `ai-session/transcript.md` is deleted outright. Pre-existing `transcript.backup.*.md` files are deleted outright. There is no escape hatch.
- **No fabrication.** If the raw session is not reachable, mark it unavailable. Never invent prompts, responses, tool calls, error messages, file contents, or commit messages.
- **No translation.** Arabic stays Arabic. English stays English. Mixed text stays mixed exactly as the candidate typed it.
- **No grammar fixes, no typo fixes, no rewording.** Preserve every misspelling, every capitalization choice, every interrupted sentence.
- **No summarization of tool output.** If you have the raw output, paste it. If you don't, mark it unavailable.
- **No removal of mistakes.** Failed commands, rejected plans, user interruptions, mid-session course corrections — all stay in.
- **No invention of metadata.** Never guess the AI tool name, the model, the candidate name, or the assessment name.
- **No silent overwrite.** The verification summary always announces what was deleted and what was written.
- **No success-on-failure.** If validation fails, the verification summary must say so. Do not flatter the user.
- **No post-generation editing.** Once written, this command's output file is immutable for the rest of the session. The only sanctioned change path is re-running `/transcript`, which deletes and rewrites.

If a constraint above conflicts with anything else in this command, the constraint above wins.
