"""
Recalculate and fix flood severity values in Supabase `flood_data` table.

Run with the same environment as the backend so SUPABASE_URL and SUPABASE_KEY
are picked up from environment variables. The script will update records in-place.
"""
import os
from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://asczdgonhfaasskhwifc.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3pkZ29uaGZhYXNza2h3aWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzIwNDgsImV4cCI6MjA5NDM0ODA0OH0.JIFnECFks2QuxbDX-iIYt6R8m7mA7QROZSZTRXfOVlA")

def compute_severity(water_level: float, warn: float, max_thr: float) -> str:
    if water_level >= max_thr:
        return "danger"
    if water_level >= warn:
        return "warning"
    return "safe"


def main():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print("Fetching flood_data records...")
    resp = supabase.table("flood_data").select("*").execute()
    rows = resp.data or []
    print(f"Found {len(rows)} records")

    updates = []
    counts = {"danger": 0, "warning": 0, "safe": 0}

    for r in rows:
        try:
            wl = float(r.get("water_level") or 0)
        except Exception:
            wl = 0.0

        warn = r.get("warn_threshold")
        max_thr = r.get("max_threshold")
        try:
            warn = float(warn) if warn is not None else 100.0
        except Exception:
            warn = 100.0
        try:
            max_thr = float(max_thr) if max_thr is not None else 180.0
        except Exception:
            max_thr = 180.0

        new_sev = compute_severity(wl, warn, max_thr)
        counts[new_sev] += 1

        # Only update if different or missing
        if str(r.get("severity") or "").lower() != new_sev:
            rec = {"id": r.get("id")} if r.get("id") else {"area_name": r.get("area_name")}
            rec.update({"severity": new_sev})
            updates.append(rec)

    print(f"Need to update {len(updates)} records")

    # Determine if table has 'severity' column; fall back to 'status' if not
    target_column = 'severity'
    if rows:
        sample = rows[0]
        if 'severity' not in sample:
            if 'status' in sample:
                target_column = 'status'
            elif 'flood_status' in sample:
                target_column = 'flood_status'

    if updates:
        print(f"Applying updates to column: {target_column} ...")
        # Prepare payloads with the chosen column
        payloads = []
        for rec in updates:
            payload = rec.copy()
            # replace 'severity' key with target_column if needed
            if 'severity' in payload and target_column != 'severity':
                payload[target_column] = payload.pop('severity')
            payloads.append(payload)

        # Perform per-record updates to avoid insert/upsert constraints
        failed = 0
        for p in payloads:
            try:
                # prefer id-based update
                if p.get('id'):
                    res = supabase.table('flood_data').update({target_column: p.get(target_column)}).eq('id', p.get('id')).execute()
                elif p.get('area_name'):
                    res = supabase.table('flood_data').update({target_column: p.get(target_column)}).eq('area_name', p.get('area_name')).execute()
                else:
                    failed += 1
                    continue
                # check for errors in response
                if getattr(res, 'error', None):
                    failed += 1
            except Exception as e:
                print(f"Update error for {p}: {e}")
                failed += 1

        print(f"Done. Failed updates: {failed}")

    print("Recalculation complete. Severity counts:")
    for k, v in counts.items():
        print(f"  {k}: {v}")


if __name__ == '__main__':
    main()
