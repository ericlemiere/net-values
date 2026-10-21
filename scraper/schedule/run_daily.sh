#!/bin/bash
# The morning job as launchd runs it: wait for the network, pull whatever was
# last pushed to main, sync the venv with requirements.txt, then run
# update_season.py. Everything it prints goes to scraper/logs/YYYY-MM-DD.log.
#
# The body is one function called on the last line, so bash has read all of it
# before git pull can rewrite this file underneath it.
#
# Run it by hand to test exactly what launchd will do:
#   scraper/schedule/run_daily.sh

main() {
    set -uo pipefail

    local scraper_dir repo_dir log_dir
    scraper_dir="$(cd "$(dirname "$0")/.." && pwd)"
    repo_dir="$(dirname "$scraper_dir")"
    log_dir="$scraper_dir/logs"
    mkdir -p "$log_dir"
    exec >>"$log_dir/$(date +%F).log" 2>&1

    echo "=== $(date) ==="

    # Wi-Fi can take a while to come back after a wake. Five minutes, then go
    # anyway: the job's own requests fail loudly enough if it is really down.
    local i
    for i in $(seq 1 30); do
        curl -s --head --max-time 5 https://www.basketball-reference.com >/dev/null && break
        sleep 10
    done

    # A failed pull isn't fatal: yesterday's code still produces today's numbers.
    git -C "$repo_dir" pull --ff-only || echo "git pull failed; running the code already here"

    "$scraper_dir/.venv/bin/pip" install -q -r "$scraper_dir/requirements.txt" \
        || echo "pip install failed; running with the packages already installed"

    find "$log_dir" -name '*.log' -mtime +30 -delete

    cd "$scraper_dir" || exit 1
    "$scraper_dir/.venv/bin/python" update_season.py
    local status=$?
    echo "=== finished $(date), exit $status ==="
    exit $status
}

main "$@"; exit
