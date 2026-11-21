#!/usr/bin/env bash
# =============================================================================
# SCU Maker 展台 —— 用 Firefox / Chromium 全屏打开本地 index.html（无需 nginx）
# 由 systemd 调用；也可手工执行：   bash /opt/maker/maker-kiosk-run.sh
# =============================================================================
set -u

[ -r /etc/maker-kiosk.conf ] && . /etc/maker-kiosk.conf
BROWSER="${BROWSER:-firefox}"
LOWFX="${LOWFX:-1}"

FILE="/srv/maker/current/index.html"
[ -f "$FILE" ] || { echo "找不到 $FILE"; exit 1; }

URL="file://$FILE"
[ "$LOWFX" = "1" ] && URL="$URL?lowfx=1"

echo "打开：$URL  （浏览器：$BROWSER）"

case "$BROWSER" in
  firefox*)
    # 独立 profile，避免每次都提示“选择用户配置文件”；kiosk 全屏；允许静态文件自动播放静音视频
    PROFILE="${KIOSK_PROFILE:-$HOME/.mozilla/maker-kiosk}"
    mkdir -p "$PROFILE"
    # 首次创建时写入偏好，避免弹窗干扰展台
    if [ ! -f "$PROFILE/prefs.js" ]; then
      cat > "$PROFILE/user.js" <<'EOF'
// SCU Maker 展台专用配置
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("startup.homepage_welcome_url", "");
user_pref("startup.homepage_welcome_url.additional", "");
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
// 自动播放：允许静音视频自动播放
user_pref("media.autoplay.default", 0);
user_pref("media.autoplay.blocking_policy", 0);
// 允许 file:// 页面读取相邻资源（默认即可，这里显式打开更稳）
user_pref("security.fileuri.strict_origin_policy", false);
// 关掉不必要的后台活动，减少板子负载
user_pref("browser.tabs.remote.autostart", false);
user_pref("gfx.webrender.software", false);
EOF
    fi
    exec firefox --kiosk --no-remote --profile "$PROFILE" "$URL"
    ;;
  chromium*)
    # Ubuntu 上可能是 chromium / chromium-browser（也可能只是个 snap 包装脚本）
    BIN="$BROWSER"
    for cand in "$BROWSER" chromium chromium-browser; do
      if command -v "$cand" >/dev/null 2>&1; then BIN="$cand"; break; fi
    done
    # 树莓派 4B 上这些参数能明显降低卡顿 / 崩溃概率
    exec "$BIN" --kiosk --incognito --noerrdialogs --disable-session-crashed-bubble \
      --autoplay-policy=no-user-gesture-required --disable-features=Translate \
      --disable-software-rasterizer=0 \
      --enable-features=VaapiVideoDecoder \
      --use-gl=egl \
      --disable-dev-shm-usage \
      --password-store=basic --use-mock-keychain \
      --allow-file-access-from-files "$URL"
    ;;
  *)
    echo "未知浏览器：$BROWSER（可设为 firefox 或 chromium）"; exit 1 ;;
esac
