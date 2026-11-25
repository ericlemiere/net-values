#!/bin/bash
# Schedules run_daily.sh (the bref half of the morning job) with launchd, every
# day at 12:10am local time, ahead of the BALLDONTLIE half at 2am Pacific. The
# order doesn't matter: each recomputes from whatever the other has written,
# and the model's writes take a database lock so they never overlap. A Mac
# asleep at 12:10 runs it when it wakes; one that's shut down skips the day.
# The desktop also has a pmset wake at 12:05am (sudo pmset repeat wakeorpoweron
# MTWRFSU 00:05:00), set by hand, not by this script.
# Safe to re-run: it replaces the old schedule.
#
# Usage:
#   scraper/schedule/install.sh            # 12:10am
#   scraper/schedule/install.sh 8 15       # 8:15am
#   scraper/schedule/install.sh --remove   # unschedule
set -euo pipefail

label="com.netvalues.daily"
plist="$HOME/Library/LaunchAgents/$label.plist"
schedule_dir="$(cd "$(dirname "$0")" && pwd)"
logs_dir="$(dirname "$schedule_dir")/logs"

launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true

if [[ "${1:-}" == "--remove" ]]; then
    rm -f "$plist"
    echo "Removed $label."
    exit 0
fi

# macOS won't let a launchd job read Documents, Desktop or Downloads without
# Full Disk Access, and fails quietly when it can't.
case "$schedule_dir" in
    "$HOME/Documents"*|"$HOME/Desktop"*|"$HOME/Downloads"*)
        echo "Warning: this repo is under Documents, Desktop or Downloads, which macOS"
        echo "blocks launchd jobs from reading. Move it (e.g. to ~/code/net-values) or give"
        echo "/bin/bash Full Disk Access in System Settings > Privacy & Security."
        ;;
esac

hour="${1:-0}"
minute="${2:-10}"
mkdir -p "$HOME/Library/LaunchAgents" "$logs_dir"

cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$label</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$schedule_dir/run_daily.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>$hour</integer>
        <key>Minute</key>
        <integer>$minute</integer>
    </dict>
    <!-- Only failures from before run_daily.sh opens its own log land here. -->
    <key>StandardOutPath</key>
    <string>$logs_dir/launchd.log</string>
    <key>StandardErrorPath</key>
    <string>$logs_dir/launchd.log</string>
</dict>
</plist>
EOF

launchctl bootstrap "gui/$(id -u)" "$plist"
printf 'Scheduled %s daily at %d:%02d.\n' "$label" "$hour" "$minute"
echo "Run it now:  launchctl kickstart gui/$(id -u)/$label"
