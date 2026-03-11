---
name: windows-utf8-safe-write
description: "Prevent Windows-specific text corruption in infinitas_bpl by enforcing UTF-8 without BOM and LF-safe edits. Use when reading or writing modified files, when using PowerShell or scripts that may change encoding/line endings, or when mojibake or abnormal git diffs suggest UTF-16/CP932/BOM/CRLF drift."
---

# Windows Utf8 Safe Write

## Overview

Use this skill to make file edits that preserve encoding and line-ending integrity on Windows.
Apply explicit UTF-8 no BOM handling and verify diffs for unintended noise before completion.

## Inputs

- Files being modified
- Intended edit method (`apply_patch`, shell command, Node, Python)
- Repository encoding constraints from `AGENTS.md` section 10

## Workflow

1. Scope only the files being changed.
2. Read text with explicit UTF-8 handling.
3. Prefer `apply_patch` for edits when practical.
4. If writing via script/command, set encoding explicitly to UTF-8 without BOM.
5. Preserve LF line endings.
6. Verify with `git diff` and reject unintended encoding/line-ending noise.
7. If mojibake or abnormal drift appears, stop and fix the write path.

## Rules

- Text files must be UTF-8 without BOM.
- Line endings must be LF unless explicitly documented otherwise.
- UTF-16 output is prohibited.
- CP932/Shift_JIS output is prohibited.
- PowerShell default encoding is unsafe; avoid implicit writes.

## Output Requirements

- Keep a short `encoding safety note` in task output:
  - Files touched
  - Write method used
  - Diff check result

## References

- `references/windows-encoding-rules.md`
- `references/safe-write-recipes.md`
