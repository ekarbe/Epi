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
# Linux machine (GitHub Actions runner, container, dev VM):
#
#   epi_null         a PulseAudio null sink ("speaker" without hardware); it is
#                    the default sink, so its monitor carries everything played
#   epi_null.monitor the null sink's monitor source (system audio capture)
#   epi_mic          a virtual microphone remapped from epi_null.monitor; it is
#                    the default source
#   module-sine      a continuous test tone (EPI_E2E_TONE_HZ, default 440 Hz)
#                    played into epi_null, so both epi_null.monitor and epi_mic
#                    carry the tone
#
# The tone is a separate module so it can be switched off while all devices
# stay in place (to prove that the tests fail on silence):
#
#   e2e/ci/setup-audio-linux.sh           # start PulseAudio, devices and tone
#   e2e/ci/setup-audio-linux.sh tone-off  # unload only the tone
#   e2e/ci/setup-audio-linux.sh tone-on   # load the tone again
#   e2e/ci/setup-audio-linux.sh stop      # kill the PulseAudio daemon
#
# The script is idempotent: running it again reuses the daemon and modules.
#
# Required packages (Debian/Ubuntu): pulseaudio pulseaudio-utils
# libasound2-plugins (ALSA -> PulseAudio plugin, so cpal's ALSA "default"
# device reaches PulseAudio) and ffmpeg built with PulseAudio input support.
#
# Sources:
#   module-null-sink, module-remap-source, module-sine:
#     https://www.freedesktop.org/wiki/Software/PulseAudio/Documentation/User/Modules/
#   ALSA pulse plugin: https://www.alsa-project.org/main/index.php/Asoundrc
#     and /usr/share/doc/libasound2-plugins

set -euo pipefail

TONE_HZ="${EPI_E2E_TONE_HZ:-440}"
SINK=epi_null
MIC=epi_mic

log() { echo "[setup-audio-linux] $*"; }

# Prints the index of the first loaded module whose line matches $1.
module_index() {
    pactl list short modules | awk -v pat="$1" '$0 ~ pat { print $1; exit }'
}

tone_on() {
    if [ -z "$(module_index "module-sine[[:space:]].*sink=${SINK}")" ]; then
        log "Playing a ${TONE_HZ} Hz tone into ${SINK}"
        pactl load-module module-sine sink="${SINK}" frequency="${TONE_HZ}" >/dev/null
    else
        log "Tone already playing into ${SINK}"
    fi
}

tone_off() {
    local idx
    while idx="$(module_index "module-sine[[:space:]].*sink=${SINK}")" && [ -n "$idx" ]; do
        log "Unloading tone module #${idx}"
        pactl unload-module "$idx"
    done
}

case "${1:-start}" in
    tone-on) tone_on; exit 0 ;;
    tone-off) tone_off; exit 0 ;;
    stop)
        # --kill asks the running per-user daemon to exit.
        pulseaudio --kill 2>/dev/null || true
        log "PulseAudio stopped"
        exit 0
        ;;
    start) ;;
    *) echo "Usage: $0 [start|tone-on|tone-off|stop]" >&2; exit 2 ;;
esac

# 1. Route ALSA's "default" PCM/control to PulseAudio for this user. cpal uses
#    ALSA on Linux, so without this it would not find a default device on a
#    machine without a sound card. Distribution hooks only do this when they
#    detect a running daemon at load time, so set it explicitly.
ASOUNDRC="${HOME}/.asoundrc"
if ! grep -qs "epi-e2e" "$ASOUNDRC"; then
    log "Writing ${ASOUNDRC} (ALSA default -> pulse)"
    cat >>"$ASOUNDRC" <<'EOF'
# epi-e2e: route the ALSA default device to PulseAudio
pcm.!default { type pulse }
ctl.!default { type pulse }
EOF
fi

# 2. Make sure the XDG Documents folder resolves. Epi stores recordings in
#    ~/Documents/Epi Library, and the `dirs` crate returns no documents
#    directory on Linux unless user-dirs.dirs defines one (CI images ship
#    without it).
USER_DIRS="${XDG_CONFIG_HOME:-$HOME/.config}/user-dirs.dirs"
if ! grep -qs "XDG_DOCUMENTS_DIR" "$USER_DIRS"; then
    log "Defining XDG_DOCUMENTS_DIR in ${USER_DIRS}"
    mkdir -p "$(dirname "$USER_DIRS")"
    # $HOME stays literal on purpose: user-dirs.dirs expands it itself.
    # shellcheck disable=SC2016
    echo 'XDG_DOCUMENTS_DIR="$HOME/Documents"' >>"$USER_DIRS"
fi
mkdir -p "${HOME}/Documents"

# 3. On GitHub's Ubuntu runners the runner user has a systemd user instance,
#    and installing the pulseaudio package enables its socket-activated user
#    units. A daemon started through that socket uses the default idle exit
#    (it quits after ~20 s without clients and takes our modules with it), and
#    the socket would block our own daemon. In CI only (never on a developer's
#    desktop), stop and mask those units so the daemon below is the only one.
if [ "${GITHUB_ACTIONS:-}" = "true" ] && command -v systemctl >/dev/null 2>&1; then
    log "CI: stopping and masking systemd user units of PulseAudio (if any)"
    systemctl --user stop pulseaudio.socket pulseaudio.service 2>/dev/null || true
    systemctl --user mask pulseaudio.socket pulseaudio.service 2>/dev/null || true
fi

# 4. Start a per-user PulseAudio daemon without idle exit. --start returns once
#    the daemon is ready (and is a no-op if it already runs). As root,
#    PulseAudio prints a warning but still runs in per-user mode, which is
#    what containers need; on GitHub runners it runs as the "runner" user.
#    module-udev-detect finds no cards on a headless machine, which is fine.
if ! pulseaudio --check 2>/dev/null; then
    log "Starting PulseAudio"
    # The daemon's own log is silenced (it would interleave with ours); on
    # failure, rerun `pulseaudio -vvv` by hand to see why.
    if ! pulseaudio --start --exit-idle-time=-1 --log-target=stderr 2>/dev/null; then
        log "PulseAudio failed to start (run 'pulseaudio -vvv' for details)"
        exit 1
    fi
fi

# Bounded wait until the server answers (no unbounded sleeps).
for _ in $(seq 1 50); do
    if pactl info >/dev/null 2>&1; then break; fi
    sleep 0.1
done
pactl info >/dev/null

# 5. Virtual speaker: a null sink, made the default sink.
if [ -z "$(module_index "module-null-sink[[:space:]].*sink_name=${SINK}")" ]; then
    log "Creating null sink ${SINK}"
    pactl load-module module-null-sink sink_name="${SINK}" \
        sink_properties=device.description=Epi_E2E_Speaker >/dev/null
fi
pactl set-default-sink "${SINK}"

# 6. Virtual microphone: a remap of the null sink's monitor, made the default
#    source. A plain monitor is usually not picked as "default input", and a
#    remapped source behaves like a regular capture device.
if [ -z "$(module_index "module-remap-source[[:space:]].*source_name=${MIC}")" ]; then
    log "Creating virtual microphone ${MIC}"
    pactl load-module module-remap-source master="${SINK}.monitor" source_name="${MIC}" \
        source_properties=device.description=Epi_E2E_Microphone >/dev/null
fi
pactl set-default-source "${MIC}"

# 7. The test tone.
tone_on

log "Sinks:"
pactl list short sinks
log "Sources:"
pactl list short sources
log "Default sink: $(pactl get-default-sink), default source: $(pactl get-default-source)"
