#!/usr/bin/env bash
# =============================================================================
# SCU Maker 展台 —— 全屏打开页面（由桌面自启或 systemd 调用）
#   手工执行：bash /opt/maker/maker-kiosk-run.sh
# =============================================================================
set -u

[ -r /etc/maker-kiosk.conf ] && . /etc/maker-kiosk.conf
BROWSER="${BROWSER:-}"
LOWFX="${LOWFX:-1}"
VIEW="${VIEW:-file}"
DELAY="${KIOSK_DELAY:-0}"

FILE="/srv/maker/current/index.html"
[ -f "$FILE" ] || { echo "找不到 $FILE（先运行 sudo /opt/maker/sync.sh）"; exit 1; }

# 组装地址
if [ "$VIEW" = "http" ]; then
  URL="http://127.0.0.1/"
else
  URL="file://$FILE"
fi
[ "$LOWFX" = "1" ] && URL="$URL?lowfx=1"

# 自动挑选浏览器（配置里没写或写错了都能兜底）
pick_browser() {
  local want="$1" b
  if [ -n "$want" ] && command -v "$want" >/dev/null 2>&1; then echo "$want"; return; fi
  for b in chromium chromium-browser firefox; do
    if command -v "$b" >/dev/null 2>&1; then echo "$b"; return; fi
  done
  echo ""
}
BIN="$(pick_browser "$BROWSER")"
[ -n "$BIN" ] || { echo "没有找到浏览器（chromium / firefox）"; exit 1; }

# 桌面就绪后再开（桌面自启时基本为 0）
if [ "${DELAY%%.*}" -gt 0 ] 2>/dev/null; then sleep "$DELAY"; fi

echo "[$(date '+%F %T')] 打开 $URL （$BIN）"

# 已经开着就不要重复开
if pgrep -f -- "--kiosk" >/dev/null 2>&1; then
  echo "已有 kiosk 浏览器在运行，退出"
  exit 0
fi

case "$BIN" in
  firefox*)
    PROFILE="${KIOSK_PROFILE:-$HOME/.mozilla/maker-kiosk}"
    mkdir -p "$PROFILE"
    if [ ! -f "$PROFILE/user.js" ]; then
      cat > "$PROFILE/user.js" <<'EOF'
// SCU Maker 展台专用配置
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("startup.homepage_welcome_url", "");
user_pref("startup.homepage_welcome_url.additional", "");
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("media.autoplay.default", 0);
user_pref("media.autoplay.blocking_policy", 0);
user_pref("security.fileuri.strict_origin_policy", false);
EOF
    fi
    # --kiosk = 无地址栏无标签栏全屏
    exec firefox --kiosk --no-remote --profile "$PROFILE" "$URL"
    ;;
  *)
    # chromium / chromium-browser：--kiosk 等价 F11 全屏，并允许静音自动播放
    exec "$BIN" \
      --kiosk \
      --incognito \
      --noerrdialogs \
      --disable-infobars \
      --disable-session-crashed-bubble \
      --autoplay-policy=no-user-gesture-required \
      --disable-features=Translate,MediaRouter \
      --password-store=basic --use-mock-keychain \
      --disable-dev-shm-usage \
      --use-gl=egl \
      --allow-file-access-from-files \
      "$URL"
    ;;
esac
