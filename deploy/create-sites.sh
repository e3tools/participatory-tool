#!/bin/bash

# Make sure the script has executable permissions (`chmod +x create-sites.sh`) before running.

set -e

# Target bench path inside the container
BENCH_DIR="/home/frappe/frappe-bench"

# Ensure we are operating inside the bench directory
cd "$BENCH_DIR"

ENGAGE_APPS="insights gis participatory_backend project_monitor"

# Collect site names passed as arguments (supports a single site or a space-separated list of sites)
SITES_TO_CREATE=("$@")

# Fall back to configured county site environment variables if no site arguments are passed
if [ ${#SITES_TO_CREATE[@]} -eq 0 ]; then
  for DEFAULT_SITE in \
    "frontend.site" \
    "$NYERI_SITE_NAME" \
    "$TAITA_SITE_NAME" \
    "$MURANGA_SITE_NAME" \
    "$VIHIGA_SITE_NAME" \
    "$NANDI_SITE_NAME" \
    "$HOMABAY_SITE_NAME" \
    "$MAKUENI_SITE_NAME"; do
    if [ -n "$DEFAULT_SITE" ]; then
      SITES_TO_CREATE+=("$DEFAULT_SITE")
    fi
  done
fi

# Set fallback default site using the first site in the list or NYERI_SITE_NAME
DEFAULT_CURRENT_SITE="${SITES_TO_CREATE[0]:-frontend.site}"
if [ -n "$DEFAULT_CURRENT_SITE" ]; then
  echo "$DEFAULT_CURRENT_SITE" > sites/current_site.txt
fi
 
# Set fallback default site (original reference)
# echo "$NYERI_SITE_NAME" > sites/current_site.txt

# 1. Wait for critical backing infrastructure
echo "Waiting for MariaDB..."
wait-for-it -t 120 "$DB_HOST:$DB_PORT" -- echo "MariaDB is up and running!"
echo "Waiting for Redis Cache..."
wait-for-it -t 120 redis-cache:6379 -- echo "Redis Cache is up and running!"
echo "Waiting for Redis Queue..."
wait-for-it -t 120 redis-queue:6379 -- echo "Redis Queue is up and running!"

# Set Common/Global DB Host config
bench set-config -g db_host db
bench set-config -g redis_cache redis://redis-cache:6379
bench set-config -g redis_queue redis://redis-queue:6379
bench set-config -g redis_socketio redis://redis-queue:6379

# Build missing asset links
bench build || true

# Helper function to create site if it doesn't exist
create_site_if_missing() {
  SITE_NAME=$1
  if [ ! -d "sites/$SITE_NAME" ]; then
    echo "Creating site : $SITE_NAME"
    bench new-site $SITE_NAME \
      --mariadb-root-password "$DB_ROOT_PASSWORD" \
      --admin-password "$ADMIN_PASSWORD" \
      --mariadb-user-host-login-scope='%'

    echo "Site Created: $SITE_NAME"

    # Use option -p when you want to parse the provided VALUE into its true primitive datatype (such as booleans, integers, lists, or dictionaries) instead of interpreting it strictly as a string
    # bench --site $SITE_NAME set-config -p allow_cors "*"    
    echo "Enable DNS-based multitenancy for site: $SITE_NAME"
    # Enable DNS-based multitenancy or port mapping
    bench --site $SITE_NAME set-config allow_cors "*" 
  else
    echo "Site $SITE_NAME already exists. Skipping creation."
  fi

  # install apps
  for APP in $ENGAGE_APPS; do
    install_app "$SITE_NAME" "$APP"
  done
}

# Helper function to create site if it doesn't exist
install_app() {
  SITE_NAME=$1
  APP_NAME=$2
  if [ ! -d "sites/$SITE_NAME" ]; then
    echo "Site: $SITE_NAME does not exist. Exiting..."
    exit 1 
  else
    echo "📦 Installing $APP_NAME on $SITE_NAME..."
    bench --site "$SITE_NAME" install-app "$APP_NAME" 
  fi
} 

# Delete the site that is not applicable
# Iterate over all sites passed to the script (or fallback list) and create each if missing
for SITE in "${SITES_TO_CREATE[@]}"; do
  if [ -n "$SITE" ]; then
    create_site_if_missing "$SITE"
  fi
done

# Enable Multitenancy
echo "Setting dns multinenant"
bench config dns_multitenant off

# Frappe sets cookie attributes (SameSite and HttpOnly) that can prevent local cross-origin requests from returning the session cookie to http://localhost:3000.
# Set same_site to Lax or None
echo "Setting set-common-config"
bench config set-common-config -c same_site Lax

echo "Starting Frappe Backend via Gunicorn..."
exec "$BENCH_DIR/env/bin/gunicorn" \
  --chdir $BENCH_DIR/sites \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --worker-class gthread \
  --threads 2 \
  --timeout 120 \
  --preload \
  frappe.app:application
