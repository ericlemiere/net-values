"""One-off repair of two split/misattributed player identities in the legacy data.

1. Kenyon Martin Sr. (id 707) carried three HOU seasons that belong to his son
   KJ Martin (id 2296). Sr. retired after 2014-15, so any 2020-21+ row on his
   record is wrong. The advanced_stats rows for 2020-21 and 2021-22 are the only
   copies that exist, so they move; everything else is already present on KJ
   from the bref backfill and is deleted as superseded.

2. Glen Rice Jr. existed as two rows covering identical seasons: id 1610 (with
   his nba_person_id, holding his stats) and id 3697 (holding his advanced
   stats). The advanced rows move onto 1610, 1610 is renamed to disambiguate it
   from Glen Rice Sr. (id 181, a different player), and the now-empty 3697 is
   removed.

Verifies the expected before-state and re-checks after; rolls back on any
surprise rather than half-applying. Safe to re-run — a second run finds nothing
to do and reports so.
"""
from db import connect

KENYON_SR, KJ = 707, 2296
RICE_JR_KEEP, RICE_JR_DUP = 1610, 3697
RICE_JR_NAME = "Glen Rice Jr."


def rows_for(cur, table, player_id, after=None):
    q = f"SELECT id, season FROM {table} WHERE player_id = %s"
    args = [player_id]
    if after:
        q += " AND season > %s"
        args.append(after)
    cur.execute(q + " ORDER BY season", args)
    return cur.fetchall()


def seasons_of(cur, table, player_id):
    cur.execute(f"SELECT season FROM {table} WHERE player_id = %s", (player_id,))
    return {r[0] for r in cur.fetchall()}


def move_or_delete(cur, table, from_id, to_id, after):
    """Reassign each stray row to `to_id`, unless `to_id` already has that
    season — then the stray is a superseded duplicate and is removed.
    (player_id, season) is unique on both tables, so reassigning into an
    occupied season would fail rather than silently overwrite.)"""
    moved, deleted = [], []
    target_seasons = seasons_of(cur, table, to_id)
    for row_id, season in rows_for(cur, table, from_id, after):
        if season in target_seasons:
            cur.execute(f"DELETE FROM {table} WHERE id = %s", (row_id,))
            deleted.append(season)
        else:
            cur.execute(
                f"UPDATE {table} SET player_id = %s WHERE id = %s", (to_id, row_id)
            )
            moved.append(season)
    return moved, deleted


def main():
    conn = connect()
    cur = conn.cursor()
    try:
        print("=== 1. Kenyon Martin Sr. -> KJ Martin ===")
        # Sr.'s real career ends 2014-15; anything later is his son's.
        cur.execute(
            "SELECT max(season) FROM player_stats_per_game WHERE player_id = %s",
            (KENYON_SR,),
        )
        last_real = cur.fetchone()[0]
        print(f"  Sr. last season with stats: {last_real}")

        for table in ("advanced_stats", "salaries"):
            moved, deleted = move_or_delete(cur, table, KENYON_SR, KJ, last_real)
            print(f"  {table}: moved {moved or 'none'}, deleted-as-duplicate {deleted or 'none'}")

        print("\n=== 2. Glen Rice Jr. (merge duplicate player row) ===")
        dup_adv = seasons_of(cur, "advanced_stats", RICE_JR_DUP)
        keep_adv = seasons_of(cur, "advanced_stats", RICE_JR_KEEP)
        clash = dup_adv & keep_adv
        if clash:
            raise RuntimeError(f"both Glen Rice rows have advanced stats for {clash}")

        moved, deleted = move_or_delete(cur, "advanced_stats", RICE_JR_DUP, RICE_JR_KEEP, None)
        print(f"  advanced_stats: moved {moved or 'none'}")

        for table in ("player_stats_per_game", "player_stats_totals", "salaries", "player_aliases"):
            col = "player_id"
            cur.execute(f"SELECT count(*) FROM {table} WHERE {col} = %s", (RICE_JR_DUP,))
            left = cur.fetchone()[0]
            if left:
                raise RuntimeError(f"{table} still references player {RICE_JR_DUP} ({left} rows)")

        cur.execute("UPDATE players SET name = %s WHERE id = %s", (RICE_JR_NAME, RICE_JR_KEEP))
        cur.execute("DELETE FROM players WHERE id = %s", (RICE_JR_DUP,))
        print(f"  renamed id {RICE_JR_KEEP} -> {RICE_JR_NAME!r}, deleted empty id {RICE_JR_DUP}")

        conn.commit()
        print("\ncommitted")
    except Exception:
        conn.rollback()
        print("\nROLLED BACK — no changes applied")
        raise

    print("\n=== verification ===")
    for pid in (KENYON_SR, KJ, RICE_JR_KEEP):
        cur.execute("SELECT name FROM players WHERE id = %s", (pid,))
        name = cur.fetchone()[0]
        parts = []
        for t in ("player_stats_per_game", "advanced_stats", "salaries"):
            cur.execute(f"SELECT min(season), max(season), count(*) FROM {t} WHERE player_id = %s", (pid,))
            lo, hi, n = cur.fetchone()
            parts.append(f"{t.split('_')[-1]}={n}({lo}..{hi})" if n else f"{t.split('_')[-1]}=0")
        print(f"  id={pid:5} {name:20} " + "  ".join(parts))

    cur.execute("SELECT id, name FROM players WHERE name ILIKE 'glen rice%' ORDER BY id")
    print("  Glen Rice rows now:", cur.fetchall())

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
