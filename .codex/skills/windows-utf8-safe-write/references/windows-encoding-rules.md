# Windows Encoding Rules

Source of truth: `AGENTS.md` section 10.

## Canonical Rules

- Text files are UTF-8 without BOM.
- Line endings are LF unless a file is explicitly documented otherwise.
- UTF-16 output is prohibited.
- CP932 and Shift_JIS output are prohibited.

## Practical Rules

- Apply strict encoding care only to files being modified.
- Do not run repository-wide encoding checks by default.
- If mojibake or abnormal diff appears, treat it as an encoding defect and fix the write path.

## Write Rules

- Always write with explicit UTF-8 no BOM.
- Prefer atomic write (temp file to replace) when supported.
- Verify `git diff` after writing to ensure no unintended encoding or line-ending noise.

## Tooling Cautions

- PowerShell default encoding is not trustworthy.
- `Set-Content` and `Out-File` require explicit encoding handling.
- Node and Python writes must specify encoding explicitly.

## Prohibited Outcomes

- UTF-16 text output.
- UTF-8 with BOM.
- Unintended CRLF/LF drift.
