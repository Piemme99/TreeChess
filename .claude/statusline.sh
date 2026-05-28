#!/usr/bin/env bash
# Statusline for TreeChess sessions.
# Gives every Claude session opened in this repo the same dedicated colour
# so it's instantly recognisable among other projects' sessions.
#
# Configured via .claude/settings.json -> statusLine.
# Input: a JSON blob on stdin describing the current session.

set -euo pipefail

# --- TreeChess dedicated colour (truecolor RGB) -----------------------------
# Warm amber orange (#E67E22) — matches the app theme's --color-primary.
# Change these three numbers to re-skin every session.
R=230
G=126
B=34
# ----------------------------------------------------------------------------

input="$(cat)"

model="$(printf '%s' "$input" | jq -r '.model.display_name // "Claude"')"
cwd="$(printf '%s' "$input" | jq -r '.workspace.current_dir // .cwd // ""')"
dir="$(basename "$cwd" 2>/dev/null || printf '%s' "$cwd")"

# Git branch, if we're in a worktree.
branch=""
if git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch="$(git -C "$cwd" branch --show-current 2>/dev/null || true)"
fi

esc=$'\033'
badge_bg="${esc}[48;2;${R};${G};${B}m${esc}[38;2;255;255;255m" # white on orange
accent="${esc}[38;2;${R};${G};${B}m"                            # orange text
dim="${esc}[2m"
reset="${esc}[0m"

# Badge + accented dir, then dim metadata.
line="${badge_bg} TreeChess ${reset}"
line+=" ${accent}${dir}${reset}"
[ -n "$branch" ] && line+=" ${dim}on${reset} ${accent}${branch}${reset}"
line+=" ${dim}(${model})${reset}"

printf '%s' "$line"
