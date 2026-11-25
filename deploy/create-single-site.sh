#!/bin/bash

# Make sure the script has executable permissions (`chmod +x  create-single-site.sh`) before running.

set -e

# Path to the main Engage site creation script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREATE_SITES_SCRIPT="$SCRIPT_DIR/create-sites.sh"

# Target single site name (can be passed as argument 1 or default to frontend.site)
SINGLE_SITE="${1:-frontend.site}"

echo "Starting single-site creation for: $SINGLE_SITE"

# Call create-sites.engage.sh with a single site argument
exec "$CREATE_SITES_SCRIPT" "$SINGLE_SITE"