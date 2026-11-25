#!/bin/bash

# Make sure the script has executable permissions (`chmod +x create-multiple-sites.sh`) before running.

set -e

# Path to the main Engage site creation script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREATE_SITES_SCRIPT="$SCRIPT_DIR/create-sites.sh"

# Define the list of sites to create (or pass custom site names as arguments)
if [ "$#" -gt 0 ]; then
  SITE_LIST=("$@")
else
  SITE_LIST=(
    "frontend.site"
    "nyeri.site"
    "taita.site"
    "muranga.site"
    "vihiga.site"
    "nandi.site"
    "homabay.site"
    "makueni.site"
  )
fi

echo "Starting multi-site creation for: ${SITE_LIST[*]}"

# Pass the entire list of sites as separate arguments to create-sites.engage.sh
exec "$CREATE_SITES_SCRIPT" "${SITE_LIST[@]}"