#!/bin/sh
# NexusMedia container entrypoint.
#
# Runs the app under the UID/GID requested via the PUID/PGID env vars so bind
# mounts on hosts like Unraid (which default to 99:100) "just work" without
# the user having to chown anything.
#
# Starts as root, chowns /data, then drops privileges with gosu before exec'ing
# whatever CMD was set on the image.

set -e

PUID="${PUID:-99}"
PGID="${PGID:-100}"
DATA_DIR="${NEXUS_DATA_DIR:-/data}"

# Ensure a group with the requested GID exists. If a group already owns that
# GID we reuse it; otherwise create "nexusgrp".
if ! getent group "$PGID" >/dev/null 2>&1; then
  groupadd -g "$PGID" nexusgrp 2>/dev/null || true
fi

# Ensure a user with the requested UID exists. If someone already owns that
# UID, reuse it; otherwise create a minimal "nexus" account.
if ! getent passwd "$PUID" >/dev/null 2>&1; then
  # -M = no home dir, -N = no per-user group (we pin to PGID).
  useradd -u "$PUID" -g "$PGID" -M -N -s /usr/sbin/nologin nexus 2>/dev/null || true
fi

mkdir -p "$DATA_DIR"
# Only chown if we're currently root; a non-root start (via `docker run --user`)
# will skip this and just run directly.
if [ "$(id -u)" = "0" ]; then
  chown -R "$PUID":"$PGID" "$DATA_DIR" || true
  chown -R "$PUID":"$PGID" /app 2>/dev/null || true
  exec gosu "$PUID:$PGID" "$@"
else
  exec "$@"
fi
