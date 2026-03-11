# Safe Write Recipes

Use these recipes when `apply_patch` is not enough.

## Read Recipes

### PowerShell

```powershell
Get-Content -Raw -Encoding utf8 <path>
```

### Node.js

```js
import { readFileSync } from "node:fs";
const text = readFileSync(path, { encoding: "utf8" });
```

### Python

```python
from pathlib import Path
text = Path(path).read_text(encoding="utf-8")
```

## Write Recipes (UTF-8 no BOM)

### PowerShell via .NET API

```powershell
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
```

### Node.js

```js
import { writeFileSync } from "node:fs";
writeFileSync(path, content, { encoding: "utf8" });
```

### Python

```python
from pathlib import Path
Path(path).write_text(content, encoding="utf-8", newline="\n")
```

## Atomic Write Pattern

1. Write to a temp file in the same directory.
2. Replace target file with temp file.
3. Re-run diff checks.

## Verification Checklist

```markdown
Encoding safety note:
- Files touched: <file list>
- Write method: <apply_patch | powershell-dotnet | node | python>
- UTF-8 no BOM explicit: yes/no
- LF preserved: yes/no
- Diff clean from encoding noise: yes/no
```

## Quick Diff Sanity

Run and inspect:

```powershell
git diff -- <path>
```

Look for:

- Unexpected full-file rewrites.
- Garbled characters.
- Broad line-ending churn with no logical code change.
