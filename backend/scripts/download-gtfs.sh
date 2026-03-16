#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GTFS_DIR="$BACKEND_DIR/gtfs-data"
ZIP_FILE="$BACKEND_DIR/gtfs.zip"

cd "$BACKEND_DIR"
mkdir -p "$GTFS_DIR"

echo "=== Downloading GTFS data ==="

CURL_OPTS="--progress-bar --max-time 600 -L -o $ZIP_FILE"

if [[ -n "$BA_CLIENT_ID" && -n "$BA_CLIENT_SECRET" ]]; then
  API_URL="https://apitransporte.buenosaires.gob.ar/colectivos/feed-gtfs?client_id=$BA_CLIENT_ID&client_secret=$BA_CLIENT_SECRET"
  echo "Using BA Transport API..."
  if curl $CURL_OPTS "$API_URL"; then
    echo "Downloaded from API"
  else
    echo "API download failed, trying public data portal..."
    rm -f "$ZIP_FILE"
    curl $CURL_OPTS "https://data.buenosaires.gob.ar/dataset/colectivos-gtfs/resource/juqdkmgo-571-resource/download"
  fi
else
  echo "Using Buenos Aires Data portal (no credentials)..."
  curl $CURL_OPTS "https://data.buenosaires.gob.ar/dataset/colectivos-gtfs/resource/juqdkmgo-571-resource/download"
fi

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
