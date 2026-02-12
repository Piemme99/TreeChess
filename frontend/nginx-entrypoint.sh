#!/bin/sh
# Production entrypoint for nginx container.
# Starts nginx and watches for a certbot reload signal file.
# When certbot renews certificates, it writes a flag file to a shared volume.
# This script detects it and sends SIGHUP to nginx to reload the new certs.

RELOAD_FLAG="/var/run/certbot-reload/reload"

# Start nginx in background
nginx -g "daemon off;" &
NGINX_PID=$!

# Watch for certbot reload signal
while kill -0 "$NGINX_PID" 2>/dev/null; do
    if [ -f "$RELOAD_FLAG" ]; then
        echo "[entrypoint] Certbot renewal detected, reloading nginx..."
        nginx -s reload
        rm -f "$RELOAD_FLAG"
    fi
    sleep 60
done

# If nginx exits, propagate exit code
wait "$NGINX_PID"
