#!/usr/bin/env bash
# Epi - Local-first Meeting Intelligence
# Copyright (C) 2026  Eike Christian Karbe
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.
#

# Sets up a virtual audio environment for the end-to-end tests on a headless
# macOS machine (GitHub-hosted macos-latest runner):
#
#   BlackHole 2ch  a virtual loopback device: whatever is played into it as
#                  an output device can be recorded from it as an input device
#   ffmpeg         plays a continuous test tone (EPI_E2E_TONE_HZ, default
#                  440 Hz) into BlackHole through AudioToolbox
#
# Recording from an input device needs microphone permission (TCC). The
# script grants kTCCServiceMicrophone to the runner agent, the shells and any
# executables passed as arguments (e.g. the test binary), in the user and
# the system TCC database. This only works where SIP is disabled, as on
# GitHub's macOS runners.
#
#   e2e/ci/setup-audio-macos.sh [EXECUTABLE...]   # install, grant, play tone
#   e2e/ci/setup-audio-macos.sh stop              # stop the tone
#
# Writes the tone player's log and PID to $EPI_E2E_WORK_DIR (default: a
# folder in $TMPDIR).
#
# Sources:
#   BlackHole: https://github.com/ExistentialAudio/BlackHole (Homebrew cask
#     blackhole-2ch)
#   coreaudiod restart: https://github.com/LABSN/sound-ci-helpers (macos/)
#   TCC rows on GitHub runners: actions/runner-images,
#     images/macos/scripts/build/configure-tccdb-macos.sh (the image already
#     grants the microphone to the runner agent; rows here are a fallback)
#   AudioToolbox output device: https://ffmpeg.org/ffmpeg-devices.html#audiotoolbox

set -euo pipefail

TONE_HZ="${EPI_E2E_TONE_HZ:-440}"
WORK_DIR="${EPI_E2E_WORK_DIR:-${TMPDIR:-/tmp}/epi-e2e-audio}"
PID_FILE="${WORK_DIR}/tone.pid"
mkdir -p "$WORK_DIR"

log() { echo "[setup-audio-macos] $*"; }

tone_running() {
    [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

if [ "${1:-}" = "stop" ]; then
    if tone_running; then kill "$(cat "$PID_FILE")"; fi
    rm -f "$PID_FILE"
    log "Tone stopped"
    exit 0
fi

# 1. Packages. blackhole-2ch is a cask with a .pkg installer (it needs sudo,
#    which is passwordless on the runners).
if ! command -v ffmpeg >/dev/null 2>&1; then
    log "Installing ffmpeg"
    brew install ffmpeg
fi
if [ ! -d "/Library/Audio/Plug-Ins/HAL/BlackHole2ch.driver" ]; then
    log "Installing BlackHole 2ch"
    brew install --cask blackhole-2ch
fi

# 2. coreaudiod loads HAL plug-ins only at start, so restart it. kickstart -k
#    restarts the launchd job; killall is the fallback for older systems
#    (launchd restarts coreaudiod on demand).
log "Restarting coreaudiod"
sudo launchctl kickstart -kp system/com.apple.audio.coreaudiod || sudo killall coreaudiod

# Bounded wait until CoreAudio lists the device. grep reads all input (grep -q
# could end system_profiler with SIGPIPE, which fails the test under pipefail).
found=0
for _ in $(seq 1 30); do
    if system_profiler SPAudioDataType 2>/dev/null | grep "BlackHole" >/dev/null; then
        found=1
        break
    fi
    sleep 1
done
log "Audio devices:"
system_profiler SPAudioDataType || true
if [ "$found" != 1 ]; then
    log "BlackHole did not appear in the audio device list"
    exit 1
fi

# 3. Microphone permission. Rows are written with named columns so the
#    statement works with the access table of every recent macOS version
#    (columns were added over time; boot_uuid and last_reminded since 14).
#    client_type 1 = absolute path, auth_value 2 = allowed, auth_reason 4 =
#    set by the system. Failures only warn: the image's own rows for the
#    runner agent usually suffice.
grant_microphone() {
    local db="$1" client="$2" sudo_cmd="$3" now cols names values
    now="$(date +%s)"
    if ! $sudo_cmd test -f "$db"; then
        log "WARNING: ${db} does not exist"
        return 0
    fi
    cols="$($sudo_cmd sqlite3 "$db" "SELECT group_concat(name, ',') FROM pragma_table_info('access');")" || cols=""
    names="service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier,flags,last_modified"
    values="'kTCCServiceMicrophone','${client}',1,2,4,1,'UNUSED',0,${now}"
    case ",${cols}," in *,boot_uuid,*) names="${names},boot_uuid"; values="${values},'UNUSED'" ;; esac
    case ",${cols}," in *,last_reminded,*) names="${names},last_reminded"; values="${values},${now}" ;; esac
    if $sudo_cmd sqlite3 "$db" "INSERT OR REPLACE INTO access (${names}) VALUES (${values});"; then
        log "Granted microphone access to ${client} in ${db}"
    else
        log "WARNING: could not grant microphone access to ${client} in ${db}"
    fi
}

USER_DB="${HOME}/Library/Application Support/com.apple.TCC/TCC.db"
SYSTEM_DB="/Library/Application Support/com.apple.TCC/TCC.db"
clients=(
    /opt/hca/hosted-compute-agent
    /usr/local/opt/runner/provisioner/provisioner
    /bin/bash
    /bin/zsh
    /bin/sh
    "$@"
)
for client in "${clients[@]}"; do
    grant_microphone "$USER_DB" "$client" ""
    grant_microphone "$SYSTEM_DB" "$client" "sudo"
done
log "Microphone rows in the user TCC database:"
sqlite3 "$USER_DB" "SELECT client, auth_value FROM access WHERE service='kTCCServiceMicrophone';" || true

# 4. The tone. ffmpeg's AudioToolbox output device plays into the device with
#    the given index; -list_devices prints "[index] name, UID" lines.
if tone_running; then
    log "Tone already playing (PID $(cat "$PID_FILE"))"
    exit 0
fi
listing="$(ffmpeg -hide_banner -f lavfi -i "sine=sample_rate=48000" -t 0.1 \
    -f audiotoolbox -list_devices true - 2>&1 || true)"
echo "$listing" | grep -E "^\[AudioToolbox|CoreAudio|\[[0-9]+\]" || true
# sed quits after the first match itself (no head, which could SIGPIPE sed).
index="$(echo "$listing" | sed -nE '/BlackHole/{s/.*\[([0-9]+)\][[:space:]]+[^,]*BlackHole.*/\1/p;q;}')"
if [ -z "$index" ]; then
    log "No AudioToolbox device index found for BlackHole"
    exit 1
fi

log "Playing a ${TONE_HZ} Hz tone into BlackHole (AudioToolbox device ${index})"
# -re paces the endless lavfi source in real time; nohup and the redirects
# detach the player so it outlives this script and the CI step.
nohup ffmpeg -hide_banner -nostats -nostdin -re \
    -f lavfi -i "sine=frequency=${TONE_HZ}:sample_rate=48000" \
    -f audiotoolbox -audio_device_index "$index" - \
    >"${WORK_DIR}/tone.log" 2>&1 &
echo $! >"$PID_FILE"

# The player must still run after a few seconds (it exits at once if the
# device cannot be opened).
for _ in $(seq 1 15); do
    if ! tone_running; then break; fi
    sleep 0.2
done
cat "${WORK_DIR}/tone.log"
if ! tone_running; then
    log "The tone player exited; see the log above"
    exit 1
fi
log "Done"
