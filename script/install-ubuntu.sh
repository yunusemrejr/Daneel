#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/yunusemrejr/Daneel.git"
BRANCH="${DANEEL_BRANCH:-dev}"
SRC_DIR="${DANEEL_SRC_DIR:-$HOME/.local/share/daneel/src}"
BIN_DIR="${DANEEL_BIN_DIR:-$HOME/.local/share/daneel/bin}"
LINK_DIR="${DANEEL_LINK_DIR:-$HOME/.local/bin}"
BIN_PATH="$BIN_DIR/daneel"
LINK_PATH="$LINK_DIR/daneel"

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer is Ubuntu-first and expects apt-get." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y git curl ca-certificates unzip build-essential pkg-config

if ! command -v bun >/dev/null 2>&1; then
  curl -fsSL https://bun.sh/install | bash
fi

export PATH="$HOME/.bun/bin:$PATH"

if [ -d "$SRC_DIR/.git" ]; then
  git -C "$SRC_DIR" remote set-url origin "$REPO_URL"
  git -C "$SRC_DIR" fetch origin "$BRANCH" --prune
  git -C "$SRC_DIR" checkout -B "$BRANCH" "origin/$BRANCH"
else
  if [ -e "$SRC_DIR" ] && [ "$(find "$SRC_DIR" -mindepth 1 -maxdepth 1 2>/dev/null | head -n 1)" ]; then
    echo "$SRC_DIR exists but is not a Git checkout. Move it away or set DANEEL_SRC_DIR." >&2
    exit 1
  fi
  mkdir -p "$(dirname "$SRC_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi

cd "$SRC_DIR"
bun install
bun run --cwd packages/opencode build --single

BUILT_BIN="$(find packages/opencode/dist -path '*/bin/opencode' -type f | head -n 1)"
if [ -z "$BUILT_BIN" ]; then
  echo "Build finished, but no compiled opencode binary was found." >&2
  exit 1
fi

mkdir -p "$BIN_DIR" "$LINK_DIR"
cp "$BUILT_BIN" "$BIN_PATH"
chmod +x "$BIN_PATH"

cat > "$LINK_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
export DANEEL_SRC_DIR="$SRC_DIR"
export DANEEL_BIN_PATH="$BIN_PATH"
exec "$BIN_PATH" "\$@"
EOF
chmod +x "$LINK_PATH"

echo "Daneel installed: $LINK_PATH"
"$LINK_PATH" --version
