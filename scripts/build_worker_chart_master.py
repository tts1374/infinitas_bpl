import argparse
import hashlib
import json
import os
import sqlite3
import tempfile
import urllib.request
from collections import Counter
from pathlib import Path

GITHUB_API_BASE = "https://api.github.com"
MASTER_REPO = "tts1374/iidx_all_songs_master"
DEFAULT_OUTPUT_PATH = Path("apps/worker/src/master/generated/iidx-song-master.json")
USER_AGENT = "Codex"

def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request) as response:
        return json.load(response)


def download_file(url: str, output_path: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request) as response, output_path.open("wb") as handle:
        handle.write(response.read())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_payload(sqlite_path: Path, release_tag: str, manifest: dict) -> dict:
    connection = sqlite3.connect(sqlite_path)
    connection.row_factory = sqlite3.Row
    cursor = connection.cursor()

    charts = [
        {
            "play_style": row["play_style"],
            "difficulty": row["difficulty"],
            "level": row["level"],
            "title": f"{row['title']}{row['title_qualifier'] or ''}",
            "title_qualifier": row["title_qualifier"] or "",
            "artist": row["artist"] or "",
            "genre": row["genre"] or "",
            "title_search_key": row["title_search_key"],
            "inf_unlock_type": row["inf_unlock_type"] or "initial",
            "inf_pack_id": row["inf_pack_id"],
        }
        for row in cursor.execute(
            """
            SELECT
              c.play_style,
              c.difficulty,
              c.level,
              m.title,
              m.title_qualifier,
              m.artist,
              m.genre,
              m.title_search_key,
              m.inf_unlock_type,
              m.inf_pack_id
            FROM chart c
            JOIN music m ON m.music_id = c.music_id
            WHERE c.is_active = 1
              AND c.is_inf_active = 1
              AND m.is_inf_active = 1
            ORDER BY m.title_search_key, c.play_style, c.difficulty
            """
        )
    ]

    chart_key_counts = Counter(
        f"{chart['play_style']}::{chart['difficulty']}::{chart['title_search_key']}" for chart in charts
    )
    unique_charts = [
        chart
        for chart in charts
        if chart_key_counts[f"{chart['play_style']}::{chart['difficulty']}::{chart['title_search_key']}"] == 1
    ]

    aliases = {
        row["alias"]: row["title_search_key"]
        for row in cursor.execute(
            """
            SELECT DISTINCT
              trim(a.alias) AS alias,
              m.title_search_key
            FROM music_title_alias a
            JOIN music m ON m.textage_id = a.textage_id
            JOIN chart c ON c.music_id = m.music_id
            WHERE c.is_active = 1
              AND c.is_inf_active = 1
              AND m.is_inf_active = 1
            ORDER BY alias, m.title_search_key
            """
        )
    }

    song_packs = [
        {
            "inf_pack_id": row["inf_pack_id"],
            "pack_code": row["pack_code"],
            "pack_name": row["pack_name"],
            "display_order": row["display_order"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in cursor.execute(
            """
            SELECT
              inf_pack_id,
              pack_code,
              pack_name,
              display_order,
              created_at,
              updated_at
            FROM inf_pack
            ORDER BY display_order DESC, inf_pack_id ASC
            """
        )
    ]

    connection.close()

    return {
        "metadata": {
            "source_repo": MASTER_REPO,
            "release_tag": release_tag,
            "sqlite_file_name": manifest["file_name"],
            "schema_version": manifest["schema_version"],
            "generated_at": manifest["generated_at"],
            "sha256": manifest["sha256"],
            "byte_size": manifest["byte_size"],
            "retained_chart_count": len(unique_charts),
            "excluded_ambiguous_chart_count": len(charts) - len(unique_charts),
        },
        "charts": unique_charts,
        "aliases": aliases,
        "song_packs": song_packs,
    }


def atomic_write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        newline="\n",
        delete=False,
        dir=path.parent,
        prefix=f".{path.name}.",
        suffix=".tmp",
    ) as handle:
        handle.write(serialized)
        temp_path = Path(handle.name)

    os.replace(temp_path, path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH))
    args = parser.parse_args()

    release = fetch_json(f"{GITHUB_API_BASE}/repos/{MASTER_REPO}/releases/latest")
    release_tag = release["tag_name"]
    assets = {asset["name"]: asset for asset in release.get("assets", [])}

    latest_asset = assets.get("latest.json")
    if latest_asset is None:
        raise SystemExit("latest.json asset was not found in the latest release.")

    manifest = fetch_json(latest_asset["browser_download_url"])
    sqlite_asset = assets.get(manifest["file_name"])
    if sqlite_asset is None:
        raise SystemExit(f"SQLite asset '{manifest['file_name']}' was not found in the latest release.")

    work_dir = Path(".tmp/build-worker-chart-master")
    work_dir.mkdir(parents=True, exist_ok=True)
    sqlite_path = work_dir / manifest["file_name"]

    download_file(sqlite_asset["browser_download_url"], sqlite_path)

    actual_size = sqlite_path.stat().st_size
    if actual_size != manifest["byte_size"]:
        raise SystemExit(
            f"SQLite byte size mismatch: expected {manifest['byte_size']}, got {actual_size}."
        )

    actual_hash = sha256_file(sqlite_path)
    if actual_hash != manifest["sha256"]:
        raise SystemExit("SQLite sha256 mismatch against latest.json.")

    payload = build_payload(sqlite_path, release_tag, manifest)
    atomic_write_json(Path(args.output), payload)


if __name__ == "__main__":
    main()
