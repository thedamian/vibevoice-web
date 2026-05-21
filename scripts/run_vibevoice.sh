#!/bin/bash
set -e

TEXT_FILE="$1"
OUTPUT_FILE="$2"
VOICE1="alloy"
VOICE2="nova"

if [ -z "$TEXT_FILE" ] || [ -z "$OUTPUT_FILE" ]; then
  echo "Usage: $0 <text_file> <output_file>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Look for vibevoice.py next to this script, at project root, or use VIBEVOICE_PATH env var
VIBEVOICE="${VIBEVOICE_PATH:-${SCRIPT_DIR}/../vibevoice.py}"

if [ ! -f "$VIBEVOICE" ]; then
  echo "vibevoice.py not found at: $VIBEVOICE" >&2
  echo "Set VIBEVOICE_PATH env var to point to vibevoice.py" >&2
  exit 1
fi

python3 "$VIBEVOICE" \
  --input "$TEXT_FILE" \
  --output "$OUTPUT_FILE" \
  --voice1 "$VOICE1" \
  --voice2 "$VOICE2"
