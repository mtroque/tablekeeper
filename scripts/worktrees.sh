#!/usr/bin/env bash
# Helpers for parallel Claude Code sessions in git worktrees and open PR status.
# Worktrees are created by Claude Code itself (`claude --worktree <name>`) under .claude/worktrees/<name>
# on branch worktree-<name>, branched from the local HEAD (see worktree.baseRef in .claude/settings.json).
# Run from the main checkout with `main` checked out.
#
#   scripts/worktrees.sh launch <name> <slice ids...>   start `claude --worktree <name> "/build <ids>"` (tmux window, or print the command)
#   scripts/worktrees.sh status                         every worktree and open PR: branch, ahead/behind main, dirty, last commit, slice spec statuses, PR check state
#   scripts/worktrees.sh sync                           rebase every clean worktree on main (and reinstall deps)
#   scripts/worktrees.sh clean                          remove worktrees whose branch is merged into main and whose changed specs are all finished (✅, ⬜ or deferred)
set -euo pipefail

MAIN_DIR="$(git rev-parse --show-toplevel)"
SESSION="$(basename "$MAIN_DIR")-agents"

require_main() {
  [ "$(git -C "$MAIN_DIR" rev-parse --abbrev-ref HEAD)" = "main" ] ||
    { echo "Run this from the main checkout with 'main' checked out." >&2; exit 1; }
}
worktrees() { # dir|branch for every worktree except the main checkout
  git -C "$MAIN_DIR" worktree list --porcelain |
    awk -v main="$MAIN_DIR" '/^worktree /{d=$2} /^branch /{b=$2; sub("refs/heads/","",b); if (d!=main) print d "|" b}'
}
is_merged() { # true when branch is an ancestor of main or its PR was rebase-merged with all patches in main
  local branch="$1"
  if git -C "$MAIN_DIR" merge-base --is-ancestor "$branch" main; then return 0; fi
  if [ -n "$(git -C "$MAIN_DIR" cherry main "$branch" 2>/dev/null | grep '^+')" ]; then return 1; fi
  command -v gh >/dev/null 2>&1 || return 1
  local merged_count
  merged_count="$(gh pr list --head "$branch" --state merged --json number --jq 'length' 2>/dev/null || echo 0)"
  [ "${merged_count:-0}" -gt 0 ]
}
branch_base() { # where a branch's own commits start
  local branch="$1" base=""
  if ! git -C "$MAIN_DIR" merge-base --is-ancestor "$branch" main; then
    git -C "$MAIN_DIR" merge-base main "$branch"; return
  fi
  # Merged (fast-forward), so main...branch is empty: use the last rebase's "onto", else where the branch was created.
  base="$(git -C "$MAIN_DIR" reflog show --format='%gs' "refs/heads/$branch" 2>/dev/null |
    sed -n -E 's/^rebase.*: .* onto ([0-9a-f]+).*/\1/p' | head -n 1)" || true
  [ -n "$base" ] || base="$(git -C "$MAIN_DIR" reflog show --format='%H' "refs/heads/$branch" 2>/dev/null | tail -n 1)" || true
  [ -n "$base" ] || base="$(git -C "$MAIN_DIR" rev-parse "$branch")"
  echo "$base"
}
spec_statuses() { # "<id> <status>" for each slice spec a worktree changed relative to main (committed or not)
  local dir="$1" branch="$2" base f
  base="$(branch_base "$branch")"
  { git -C "$dir" diff --name-only "$base" -- docs/slices/
    git -C "$dir" ls-files --others --exclude-standard -- docs/slices/
  } | sort -u | while read -r f; do
    case "$f" in docs/slices/_*) continue ;; *.md) ;; *) continue ;; esac
    [ -f "$dir/$f" ] || continue
    sed -n -E 's|^\*\*Status:\*\* *([^ ]*).*|\1|p' "$dir/$f" | head -n 1 |
      sed "s|^|$(basename "$f" .md) |"
  done
}
unfinished() { # statuses other than ✅, ⬜ and deferred
  awk '$2 != "✅" && $2 != "⬜" && $2 != "deferred"'
}

cmd_launch() {
  require_main
  local name="${1:-}"; shift || true
  [ -n "$name" ] && [ "$#" -gt 0 ] || { echo "Usage: scripts/worktrees.sh launch <name> <slice ids...>" >&2; exit 1; }
  local run="claude --worktree $name \"/build $*\""
  if ! command -v tmux >/dev/null 2>&1; then
    echo "tmux not found. In a new terminal, run:"
    echo "  cd $MAIN_DIR && $run"
    return
  fi
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    tmux new-window -t "$SESSION" -n "$name" -c "$MAIN_DIR" "$run; exec \$SHELL"
  else
    tmux new-session -d -s "$SESSION" -n "$name" -c "$MAIN_DIR" "$run; exec \$SHELL"
  fi
  echo "▶ $name: /build $*   (tmux attach -t $SESSION, next window: Ctrl-b n)"
}

cmd_status() {
  local dir branch counts ahead behind dirty last found=0
  printf "%-16s %-26s %5s %6s %-5s %s\n" WORKTREE BRANCH AHEAD BEHIND DIRTY "LAST COMMIT"
  while IFS='|' read -r dir branch; do
    found=1
    counts="$(git -C "$MAIN_DIR" rev-list --left-right --count "main...$branch")"
    behind="${counts%%[[:space:]]*}"; ahead="${counts##*[[:space:]]}"
    dirty=no; [ -n "$(git -C "$dir" status --porcelain)" ] && dirty=yes
    last="$(git -C "$dir" log -1 --format='%cr: %s')"
    printf "%-16s %-26s %5s %6s %-5s %s\n" "$(basename "$dir")" "$branch" "$ahead" "$behind" "$dirty" "$last"
    spec_statuses "$dir" "$branch" | sed 's/^/    /'
  done < <(worktrees)
  [ "$found" -eq 1 ] || echo "(no worktrees)"

  if command -v gh >/dev/null 2>&1; then
    echo ""
    printf "%-6s %-26s %-10s %s\n" PR BRANCH CHECKS TITLE
    local prs
    prs="$(gh pr list --state open --json number,headRefName,title,isDraft,statusCheckRollup --jq '
      if length == 0 then "(no open PRs)"
      else .[] | [
        "#\(.number)",
        .headRefName,
        (if .isDraft then "DRAFT"
         elif (.statusCheckRollup | length) == 0 then "PENDING"
         elif any(.statusCheckRollup[]; .conclusion == "FAILURE" or .conclusion == "TIMED_OUT" or .conclusion == "CANCELLED" or .conclusion == "ACTION_REQUIRED") then "FAIL"
         elif any(.statusCheckRollup[]; .status != "COMPLETED") then "PENDING"
         else "PASS" end),
        .title
      ] | @tsv end
    ' 2>/dev/null || echo "(could not query PRs)")"
    if [ "$prs" = "(no open PRs)" ] || [ "$prs" = "(could not query PRs)" ]; then
      echo "$prs"
    else
      while IFS=$'\t' read -r num br chk title; do
        printf "%-6s %-26s %-10s %s\n" "$num" "$br" "$chk" "$title"
      done <<< "$prs"
    fi
  fi
}

cmd_sync() {
  require_main
  local dir branch
  while IFS='|' read -r dir branch; do
    if [ -n "$(git -C "$dir" status --porcelain)" ]; then echo "⏭  $branch: uncommitted changes, skipped"; continue; fi
    if git -C "$dir" rebase -q main >/dev/null 2>&1; then
      echo "✅ $branch rebased on main"
      if [ -f "$dir/package.json" ]; then (cd "$dir" && pnpm install --frozen-lockfile --silent) || true; fi
    else
      git -C "$dir" rebase --abort >/dev/null 2>&1 || true
      echo "⚠️  $branch conflicts with main; rebase aborted (ask that session to rebase and resolve)"
    fi
  done < <(worktrees)
}

cmd_clean() {
  require_main
  local dir branch
  while IFS='|' read -r dir branch; do
    if [ -n "$(git -C "$dir" status --porcelain)" ]; then echo "⏭  $branch: uncommitted changes, kept"; continue; fi
    if ! is_merged "$branch"; then echo "⏭  $branch: not merged into main, kept"; continue; fi
    if [ -n "$(spec_statuses "$dir" "$branch" | unfinished)" ]; then echo "⏭  $branch: has unfinished slices, kept"; continue; fi
    if git -C "$MAIN_DIR" worktree remove "$dir" 2>/dev/null; then
      git -C "$MAIN_DIR" branch -D "$branch" >/dev/null 2>&1 || true
      echo "🧹 removed $(basename "$dir") ($branch)"
    else
      echo "⚠️  $branch: could not remove $dir (still open in a session, or locked: git worktree unlock $dir)"
    fi
  done < <(worktrees)
}

case "${1:-}" in
  launch) shift; cmd_launch "$@" ;;
  status) cmd_status ;;
  sync)   cmd_sync ;;
  clean)  cmd_clean ;;
  *) sed -n '2,11p' "$0"; exit 1 ;;
esac
