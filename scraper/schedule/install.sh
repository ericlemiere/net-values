#!/bin/bash
# Schedules run_daily.sh with launchd, every day at 7:30am local time (by then
# every West Coast game is final). Safe to re-run: it replaces the old schedule.
#
# Usage:
#   scraper/schedule/install.sh            # 7:30am
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

hour="${1:-7}"
minute="${2:-30}"
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
