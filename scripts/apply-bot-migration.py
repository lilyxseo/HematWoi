"""Apply the bot's additive prerequisite schema before deploying its Edge Function."""
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.request


def apply_migration():
    token = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
    project = os.environ.get("PROJECT_ID", "")
    if not token or not re.fullmatch(r"[a-z0-9]+", project):
        raise RuntimeError("SUPABASE_ACCESS_TOKEN and a valid PROJECT_ID are required")
    migration = Path(__file__).resolve().parents[1] / "supabase/migrations/20261026000000_bot_recording_workflow.sql"
    # Atomic and serialized across concurrent deployment attempts; reruns preserve data.
    query = "BEGIN;\nSELECT pg_advisory_xact_lock(hashtextextended('hematwoi:bot-recording-schema', 0));\n" + migration.read_text() + "\nCOMMIT;"
    request = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{project}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            if response.status != 200:
                raise RuntimeError(f"Database migration returned HTTP {response.status}")
            response.read()
    except urllib.error.HTTPError as error:
        details = error.read(4096).decode(errors="replace").replace(token, "[REDACTED]")
        raise RuntimeError(f"Database migration failed (HTTP {error.code}): {details}") from None
    print("Bot database prerequisites applied; PostgREST schema reload requested.")


if __name__ == "__main__":
    apply_migration()
