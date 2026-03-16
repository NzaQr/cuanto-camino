#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GTFS_DIR="$BACKEND_DIR/gtfs-data"
ZIP_FILE="$BACKEND_DIR/gtfs.zip"

cd "$BACKEND_DIR"
mkdir -p "$GTFS_DIR"

if [[ -z "$BA_CLIENT_ID" || -z "$BA_CLIENT_SECRET" ]]; then
  echo "ERROR: BA_CLIENT_ID and BA_CLIENT_SECRET must be set"
  exit 1
fi

echo "=== Downloading GTFS data ==="
API_URL="https://apitransporte.buenosaires.gob.ar/colectivos/feed-gtfs?client_id=$BA_CLIENT_ID&client_secret=$BA_CLIENT_SECRET"
curl --progress-bar -L -o "$ZIP_FILE" "$API_URL"

echo "Verifying zip..."
unzip -t "$ZIP_FILE" > /dev/null

echo "Extracting to $GTFS_DIR..."
unzip -o -q "$ZIP_FILE" -d "$GTFS_DIR"
rm -f "$ZIP_FILE"

SUBDIR=$(find "$GTFS_DIR" -maxdepth 1 -type d ! -path "$GTFS_DIR" | head -1)
if [[ -n "$SUBDIR" && -f "$SUBDIR/stops.txt" ]]; then
  mv "$SUBDIR"/* "$GTFS_DIR/"
  rmdir "$SUBDIR"
fi

for f in stops.txt routes.txt trips.txt stop_times.txt shapes.txt; do
  if [[ ! -f "$GTFS_DIR/$f" ]]; then
    echo "ERROR: Missing $f after extraction"
    exit 1
  fi
done

echo "GTFS data ready at $GTFS_DIR"
