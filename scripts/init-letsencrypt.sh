#!/bin/bash
# =============================================================================
# Kumquat — Let's Encrypt certificate initialization
# =============================================================================
# Usage: ./scripts/init-letsencrypt.sh yourdomain.com [your@email.com]
#
# This script:
# 1. Creates a temporary self-signed certificate so nginx can start
# 2. Starts nginx and certbot containers
# 3. Deletes the temporary certificate
# 4. Requests a real certificate from Let's Encrypt
# 5. Reloads nginx with the real certificate
#
# After this initial setup, certbot auto-renews via the certbot service
# in docker-compose.prod.yml (checks every 12 hours).
# =============================================================================

set -euo pipefail

# --- Configuration ---
DOMAIN="${1:?Usage: $0 <domain> [email]}"
EMAIL="${2:-}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
CERT_PATH="./certbot/conf/live/kumquat"

# Use staging for testing (set to 1 to avoid rate limits during testing)
STAGING="${STAGING:-0}"

echo "=== Kumquat Let's Encrypt Initialization ==="
echo "Domain: $DOMAIN"
echo "Email:  ${EMAIL:-not provided (will use --register-unsafely-without-email)}"
echo "Staging: $STAGING"
echo ""

# --- Step 1: Create directories ---
echo ">>> Creating certificate directories..."
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# --- Step 2: Generate temporary self-signed certificate ---
# Nginx needs a certificate to start on port 443. We create a temporary one,
# then replace it with the real Let's Encrypt certificate.
if [ ! -d "$CERT_PATH" ]; then
    echo ">>> Generating temporary self-signed certificate..."
    mkdir -p "$CERT_PATH"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "$CERT_PATH/privkey.pem" \
        -out "$CERT_PATH/fullchain.pem" \
        -subj "/CN=$DOMAIN" \
        2>/dev/null
    echo "    Temporary certificate created."
else
    echo ">>> Certificate directory already exists, skipping temporary cert."
fi

# --- Step 3: Start nginx (frontend) ---
echo ">>> Starting frontend (nginx)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d frontend
echo "    Waiting for nginx to be ready..."
sleep 5

# --- Step 4: Delete temporary certificate ---
echo ">>> Removing temporary certificate..."
rm -rf "$CERT_PATH"

# --- Step 5: Request real certificate from Let's Encrypt ---
echo ">>> Requesting Let's Encrypt certificate..."

STAGING_FLAG=""
if [ "$STAGING" = "1" ]; then
    STAGING_FLAG="--staging"
    echo "    (Using Let's Encrypt STAGING environment)"
fi

EMAIL_FLAG="--register-unsafely-without-email"
if [ -n "$EMAIL" ]; then
    EMAIL_FLAG="--email $EMAIL"
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    $STAGING_FLAG \
    $EMAIL_FLAG \
    --agree-tos \
    --no-eff-email \
    --cert-name kumquat \
    -d "$DOMAIN"

# --- Step 6: Reload nginx with real certificate ---
echo ">>> Reloading nginx with the real certificate..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec frontend nginx -s reload

echo ""
echo "=== Done! ==="
echo "Your site should now be accessible at https://$DOMAIN"
echo ""
echo "Certificate auto-renewal is handled by the certbot service"
echo "in $COMPOSE_FILE (checks every 12 hours)."
echo ""
echo "To test renewal: docker compose --env-file $ENV_FILE -f $COMPOSE_FILE run --rm certbot renew --dry-run"
