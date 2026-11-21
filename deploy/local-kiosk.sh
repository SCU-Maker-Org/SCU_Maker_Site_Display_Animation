#!/usr/bin/env bash
# =============================================================================
# SCU Maker 展台 —— 无需 nginx：本地文件 + Firefox 直接全屏
# -----------------------------------------------------------------------------
#  适用：不想开 nginx / 只在本机接显示器播放
#  行为：把最新版本同步到 /srv/maker/current，然后用 Firefox 打开
#        file:///srv/maker/current/index.html
#
#  用法：
#     sudo bash local-kiosk.sh install     # 安装开机自启（不装 nginx 依赖）
#     sudo bash local-kiosk.sh start       # 立即启动一次
#     sudo bash local-kiosk.sh stop        # 停止
#     sudo bash local-kiosk.sh status      # 状态
#     sudo bash local-kiosk.sh uninstall   # 卸载
#
#  可改参数（写在 /etc/maker-kiosk.conf）：
#     BROWSER=firefox | chromium
#     LOWFX=1            # 加 ?lowfx=1，板子上更省资源
# =============================================================================
set -euo pipefail

CONF="/etc/maker-kiosk.conf"
SERVICE="/etc/systemd/system/maker-kiosk.service"
URL_FILE="/srv/maker/current/index.html"

need_root() { [ "$(id -u)" -eq 0 ] || { echo "请用 sudo 运行"; exit 1; }; }

# 找到桌面用户（Firefox 需要 /home 下的用户 + DISPLAY 才能开窗）
detect_user() {
  local u="${KIOSK_USER:-}"
  if [ -z "$u" ]; then
    u="$(loginctl list-sessions --no-legend 2>/dev/null | awk '{print $3}' | grep -v '^$' | head -n1 || true)"
  fi
  if [ -z "$u" ] || [ "$u" = "root" ]; then
    u="$(getent passwd | awk -F: '$3>=1000 && $3<65000 {print $1}' | head -n1)"
  fi
  echo "${u:-root}"
}

write_conf() {
  if [ ! -f "$CONF" ]; then
    cat > "$CONF" <<'EOF'
# SCU Maker 本地全屏播放配置
BROWSER=firefox        # firefox / chromium / chromium-browser
LOWFX=1                # 1 = 加 ?lowfx=1（树莓派 4B 上明显更流畅），0 = 关闭
KIOSK_DELAY=8          # 开机后等桌面起来再开浏览器（秒）
# KIOSK_USER=pi        # 默认自动探测桌面用户
EOF
  fi
}

detect_browser() {
  if [ -n "${KIOSK_BROWSER:-}" ]; then echo "$KIOSK_BROWSER"; return; fi
  if command -v firefox >/dev/null 2>&1; then echo firefox
  elif command -v chromium >/dev/null 2>&1; then echo chromium
  elif command -v chromium-browser >/dev/null 2>&1; then echo chromium-browser
  else echo ""; fi
}

install_service() {
  write_conf
  local user; user="$(detect_user)"

  # 桌面环境检查（kiosk 必须有图形界面 + DISPLAY）
  if ! loginctl list-sessions --no-legend 2>/dev/null | grep -q . ; then
    echo "提示：当前没有登录的图形会话，kiosk 无法立即显示。"
    echo "      Ubuntu 桌面版请以桌面用户登录（自动登录见 deploy/README.md 第十节）。"
  fi
  if [ -z "$(detect_browser)" ]; then
    echo "警告：没有找到 firefox / chromium，请先安装："
    echo "      sudo apt install -y firefox        # 或 sudo snap install firefox"
    echo "      sudo apt install -y chromium-browser"
  else
    echo "使用浏览器：$(detect_browser)（可在 $CONF 里改 BROWSER=）"
  fi
  cat > "$SERVICE" <<EOF
[Unit]
Description=SCU Maker kiosk (local file, no nginx)
After=graphical.target network-online.target
Wants=graphical.target

[Service]
User=$user
Environment=DISPLAY=:0
Environment=XAUTHORITY=/home/$user/.Xauthority
Environment=KIOSK_DELAY=${KIOSK_DELAY:-6}
EnvironmentFile=-$CONF
ExecStartPre=/bin/bash -c 'for i in $(seq 1 60); do [ -f /srv/maker/current/index.html ] && break; sleep 2; done; sleep $${KIOSK_DELAY}'
ExecStart=/opt/maker/maker-kiosk-run.sh
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
EOF
  systemctl daemon-reload
  systemctl enable --now maker-kiosk.service
  echo "已安装并启动（用户：$user，显示器：:0）"
  echo "配置文件：$CONF"
}

uninstall_service() {
  systemctl disable --now maker-kiosk.service 2>/dev/null || true
  rm -f "$SERVICE"
  systemctl daemon-reload
  echo "已卸载开机自启（页面文件与 /srv/maker 保留）"
}

start_now() {
  write_conf
  systemctl start maker-kiosk.service 2>/dev/null || true
  echo "已请求启动"
}

stop_now() {
  systemctl stop maker-kiosk.service 2>/dev/null || true
  pkill -f 'firefox.*index.html' 2>/dev/null || true
  pkill -f 'chromium.*index.html' 2>/dev/null || true
  echo "已停止"
}

status_now() {
  echo "== 服务状态 =="
  systemctl --no-pager status maker-kiosk.service 2>/dev/null | head -n 12 || echo "未安装"
  echo
  echo "== 页面文件 =="
  ls -l "$URL_FILE" 2>/dev/null || echo "还没有内容：先运行 sudo /opt/maker/sync.sh"
  echo
  echo "== 手动打开命令 =="
  echo "  firefox --kiosk file://$URL_FILE"
}

case "${1:-install}" in
  install)   need_root; install_service ;;
  uninstall) need_root; uninstall_service ;;
  start)     need_root; start_now ;;
  stop)      need_root; stop_now ;;
  status)    status_now ;;
  *) echo "用法：$0 [install|uninstall|start|stop|status]"; exit 2 ;;
esac
