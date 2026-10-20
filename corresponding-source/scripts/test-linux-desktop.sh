#!/usr/bin/env bash
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo 'Disposable CI desktop only'; exit 1; }
kind="${1:-}"
[[ "$kind" == x11 || "$kind" == wayland ]] || exit 1
unset XDG_SESSION_ID XDG_CURRENT_DESKTOP
export XDG_SESSION_TYPE="$kind" FOCUSRECALL_NATIVE_DISPLAY="$kind"
export FOCUSRECALL_NATIVE_QA_OUTPUT="docs/verification/native-ci/$kind"
runtime=$(mktemp -d "$RUNNER_TEMP/focusrecall-desktop-XXXXXX")
export XDG_RUNTIME_DIR="$runtime"
chmod 700 "$runtime"
desktop_pid=''
trap '[[ -z "$desktop_pid" ]] || kill "$desktop_pid" 2>/dev/null || true' EXIT
if [[ "$kind" == x11 ]]; then
  openbox >"$runtime/openbox.log" 2>&1 & desktop_pid=$!
else
  renderer=--use-pixman
  if weston --help | grep -q -- --renderer; then renderer=--renderer=pixman; fi
  weston --backend=x11-backend.so "$renderer" --socket=focusrecall-wayland --width=1920 --height=1080 --idle-time=0 --log="$runtime/weston.log" & desktop_pid=$!
  export WAYLAND_DISPLAY=focusrecall-wayland
  for _ in {1..80}; do [[ ! -S "$runtime/$WAYLAND_DISPLAY" ]] || break; sleep .1; done
  [[ -S "$runtime/$WAYLAND_DISPLAY" ]] || { cat "$runtime/weston.log"; exit 1; }
fi
echo "REAL compositor: $kind; no GNOME/KDE/logind desktop login is being simulated."
node scripts/verify-native-workflows.cjs || { [[ ! -f "$runtime/weston.log" ]] || tail -n 50 "$runtime/weston.log"; exit 1; }
