#!/bin/bash
# The morning job as launchd runs it: wait for the network, pull whatever was
# last pushed to main, sync the venv with requirements.txt, then run
# update_season.py. Everything it prints goes to scraper/logs/YYYY-MM-DD.log.
#
# With HEALTHCHECK_URL set (in .env.local, or the environment), each run
# reports to that healthchecks.io check: started, then succeeded or failed with
# the end of the log attached. The check's own schedule catches the run that
# never happens at all, which nothing in here can. Unset, it reports nothing.
#
# The body is one function called on the last line, so bash has read all of it
# before git pull can rewrite this file underneath it.
#
# Run it by hand to test exactly what launchd will do:
#   scraper/schedule/run_daily.sh

main() {
    set -uo pipefail

    local scraper_dir repo_dir log_dir log
    scraper_dir="$(cd "$(dirname "$0")/.." && pwd)"
    repo_dir="$(dirname "$scraper_dir")"
    log_dir="$scraper_dir/logs"
    log="$log_dir/$(date +%F).log"
    mkdir -p "$log_dir"
    exec >>"$log" 2>&1

    echo "=== $(date) ==="

    # Up to twenty minutes' random delay, so nba.com doesn't see the same
    # address at the same minute every day, which is what its bot protection
    # looks for. Skipped when run by hand from a terminal; launchd gives the
    # job no terminal.
    if [[ ! -t 0 ]]; then
        local delay=$((RANDOM % 1200))
        echo "waiting ${delay}s before starting"
        sleep "$delay"
    fi

    # Wi-Fi can take a while to come back after a wake. Five minutes, then go
    # anyway: the job's own requests fail loudly enough if it is really down.
    local i
    for i in $(seq 1 30); do
        curl -s --head --max-time 5 https://www.basketball-reference.com >/dev/null && break
        sleep 10
    done

    local hc_url="${HEALTHCHECK_URL:-}"
    if [[ -z "$hc_url" ]]; then
        hc_url="$(sed -n 's/^HEALTHCHECK_URL=//p' "$repo_dir/.env.local" 2>/dev/null | tr -d '"' | tail -n 1)"
    fi
    # Never lets a reporting problem stop or fail the job itself.
    hc_ping() {
        [[ -n "$hc_url" ]] || return 0
        curl -fsS -m 10 --retry 3 -o /dev/null "$@" || echo "healthcheck ping failed"
    }
    hc_ping "$hc_url/start"

    # Every run rewrites the scraper's unmatched/collision reports, which are
    # tracked, so this copy always has them modified, and a pull that touches
    # one refuses to run. They're regenerated below either way.
    git -C "$repo_dir" checkout -- 'scraper/*.csv'

    # A failed pull isn't fatal: yesterday's code still produces today's numbers.
    git -C "$repo_dir" pull --ff-only || echo "git pull failed; running the code already here"

    "$scraper_dir/.venv/bin/pip" install -q -r "$scraper_dir/requirements.txt" \
        || echo "pip install failed; running with the packages already installed"

    find "$log_dir" -name '*.log' -mtime +30 -delete

    # Unbuffered (-u): Python otherwise holds file output back in blocks, so a
    # run that's killed loses its last few steps from the log, and the log
    # stops short of where the run actually got to.
    cd "$scraper_dir" && "$scraper_dir/.venv/bin/python" -u update_season.py
    local status=$?
    echo "=== finished $(date), exit $status ==="

    if [[ $status -eq 0 ]]; then
        hc_ping "$hc_url"
    else
        # The traceback is at the end; this lands in the alert email.
        tail -n 80 "$log" | hc_ping --data-binary @- "$hc_url/fail"
    fi
    exit $status
}

main "$@"; exit
