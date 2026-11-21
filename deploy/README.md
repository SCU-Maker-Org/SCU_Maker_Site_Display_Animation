# SCU Maker 展台 —— 香橙派 Kunpeng Pro 部署

本目录提供一套「**从 GitHub 定期拉取 → 自动发布 → 失败自动回滚**」的部署方案，
适用于香橙派 Kunpeng Pro（openEuler / Ubuntu / Debian 均可）。

```
deploy/
├── install.sh            一键安装（nginx + 定时更新 + 首次发布）
├── sync.sh               拉取/发布/回滚脚本（定时器实际调用它）
├── nginx-maker.conf      nginx 完整配置（Ubuntu/Debian 用）
└── nginx-server.conf     nginx 站点片段（openEuler/CentOS/RHEL 用）
```

---

## 一、最快的方式（3 条命令）

把仓库推送到 GitHub 后，在香橙派上执行：

```bash
sudo dnf install -y git            # openEuler；Ubuntu/Debian 用 sudo apt install -y git
git clone https://github.com/SCU-Maker-Org/SCU_Maker_Site_Display_Animation.git ~/maker-src
sudo bash ~/maker-src/deploy/install.sh
```

安装脚本会：

1. 安装 `nginx git rsync curl`；
2. 建目录 `/srv/maker`（`repo/` 克隆、`releases/` 各版本、`current/` 软链接指向当前版本）；
3. 安装 `/opt/maker/sync.sh`；
4. 写入 nginx 站点配置（网站根目录 `/srv/maker/current`）；
5. 首次拉取并发布；
6. 安装 `maker-sync.timer`（**每 5 分钟**检查一次 GitHub 更新）；
7. 放行 80 端口；
8. 询问是否配置**定时开关机**（22:30 关机 / 07:00 RTC 唤醒，见第七节）。

完成后访问 `http://<香橙派IP>/` 即可。

> 如果不想克隆整个仓库，只下载部署脚本（`sync.sh` 自己会把网站代码 clone 到 `/srv/maker/repo`）：
>
> ```bash
> RAW=https://raw.githubusercontent.com/SCU-Maker-Org/SCU_Maker_Site_Display_Animation/main/deploy
> sudo dnf install -y nginx git rsync && sudo systemctl enable --now nginx
> sudo mkdir -p /opt/maker
> sudo curl -fsSL "$RAW/sync.sh"           -o /opt/maker/sync.sh
> sudo curl -fsSL "$RAW/nginx-server.conf" -o /etc/nginx/conf.d/maker.conf   # Ubuntu 请改用 nginx-maker.conf
> sudo chmod +x /opt/maker/sync.sh
> sudo nginx -t && sudo systemctl reload nginx
> sudo /opt/maker/sync.sh
> ```

---

## 二、手动部署（不用 install.sh）

```bash
# 1. 依赖
sudo dnf install -y nginx git rsync          # Ubuntu: sudo apt install -y nginx git rsync
sudo systemctl enable --now nginx

# 2. 目录
sudo mkdir -p /srv/maker/{repo,releases,logs} /opt/maker
sudo install -m 755 deploy/sync.sh /opt/maker/sync.sh

# 3. nginx 配置
#    openEuler / CentOS / RHEL：
sudo cp deploy/nginx-server.conf /etc/nginx/conf.d/maker.conf
#    Ubuntu / Debian：
#    sudo cp deploy/nginx-maker.conf /etc/nginx/sites-available/maker.conf
#    sudo ln -sf /etc/nginx/sites-available/maker.conf /etc/nginx/sites-enabled/maker.conf
sudo nginx -t && sudo systemctl reload nginx

# 4. 首次拉取发布
sudo /opt/maker/sync.sh

# 5. 定时更新（下面二选一）
```

### 方式 A：cron（最简单）

```bash
# 每 5 分钟拉一次，日志已在脚本内写到 /srv/maker/logs/sync.log
( sudo crontab -l 2>/dev/null; echo "*/5 * * * * /opt/maker/sync.sh --update >/dev/null 2>&1" ) | sudo crontab -
```

### 方式 B：systemd timer（推荐，日志进 journald）

```bash
sudo tee /etc/systemd/system/maker-sync.service >/dev/null <<'EOF'
[Unit]
Description=SCU Maker display: pull latest site from GitHub
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/opt/maker/sync.sh --update
Nice=10
EOF

sudo tee /etc/systemd/system/maker-sync.timer >/dev/null <<'EOF'
[Unit]
Description=Periodically update SCU Maker display from GitHub

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now maker-sync.timer
systemctl list-timers maker-sync.timer     # 查看下次触发时间
```

> 想改成 1 分钟 / 30 分钟：改 `OnUnitActiveSec=1min` 或 `30min`，再 `sudo systemctl daemon-reload && sudo systemctl restart maker-sync.timer`。

---

## 三、更新流程怎么工作

```
GitHub (main)
     │  git fetch（深度 1，只拉最新）
     ▼
/srv/maker/repo            ← 干净的工作副本
     │  rsync（排除 .git/ assets/ tools/ README）
     ▼
/srv/maker/releases/20261121-153000-a1b2c3d/
     │  校验必需文件 → 原子切换
     ▼
/srv/maker/current  →  上面的版本目录      ← nginx 根目录
```

- **无更新**：比对 commit，相同就直接退出，不重复发布。
- **发布失败**（缺 `index.html`、`动画.mp4` 等）：自动丢弃这一版，站点保持原样。
- **保留最近 5 个版本**，可随时回滚。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `sudo /opt/maker/sync.sh` | 立即检查并更新 |
| `sudo /opt/maker/sync.sh --status` | 当前提交、当前版本、可用版本 |
| `sudo /opt/maker/sync.sh --rollback` | 回退到上一版 |
| `tail -f /srv/maker/logs/sync.log` | 看更新日志 |
| `journalctl -u maker-sync.service -n 50` | 看 systemd 定时任务日志 |
| `systemctl list-timers maker-sync.timer` | 看下次更新时间 |

---

## 四、只更新海报内容、不改代码的做法

`js/config.js`（活动信息）和 `动画.mp4`（开场视频）都在仓库里，所以**改完推送到 GitHub，最多 5 分钟**自动生效。

因为 nginx 对 `index.html` 和 `js/*.js` 设置了 `no-cache`，展台机器刷新后就会拿到新内容；
墙上的播放器如果长时间不刷新，可以加一条「定时刷新页面」的策略：

```bash
# 每天凌晨 4 点自动刷新一次展台浏览器（按你的浏览器改命令）
# 例如用 kiosk 模式启动的 Chromium：
# 0 4 * * * pkill -f chromium; sleep 2; DISPLAY=:0 chromium --kiosk http://127.0.0.1/ &
```

> 提示：`动画.mp4` 有 19MB，每次替换后首次加载会重新下载一次（之后走浏览器缓存）。

---

## 五、开机自动全屏（可选）

香橙派接显示器做展台时，让浏览器开屏即全屏：

```bash
sudo apt install -y chromium-browser 2>/dev/null || sudo dnf install -y chromium

sudo tee /etc/systemd/system/maker-kiosk.service >/dev/null <<'EOF'
[Unit]
Description=SCU Maker kiosk display
After=graphical.target network-online.target
Wants=network-online.target

[Service]
User=orangepi
Environment=DISPLAY=:0
ExecStartPre=/bin/sleep 10
ExecStart=/usr/bin/chromium --kiosk --noerrordlg --disable-session-crashed-bubble \
    --autoplay-policy=no-user-gesture-required \
    --incognito http://127.0.0.1/
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now maker-kiosk.service
```

- `--autoplay-policy=no-user-gesture-required`：允许开场视频**静音自动播放**，务必保留。
- `--incognito`：每次启动都是干净缓存，避免旧版页面残留。
- 页面右上角有全屏按钮，键盘 `F` 也可以切全屏。

---

## 六、常见问题

**打不开页面**
```bash
systemctl status nginx
sudo nginx -t
ls -l /srv/maker/current           # 必须是软链接，指向 releases/<版本>
curl -I http://127.0.0.1/          # 本机自测
```
云/路由器环境还需要在上级防火墙放行 80 端口。

**一直不更新**
```bash
sudo /opt/maker/sync.sh            # 手动跑一次，看输出
tail -n 50 /srv/maker/logs/sync.log
cd /srv/maker/repo && git status   # 若显示本地有改动，脚本会跳过更新
```

**视频不播放 / 黑屏**
确认 nginx 返回的内容类型是 `video/mp4`：

```bash
curl -I http://127.0.0.1/动画.mp4   # 应返回 200 与 Content-Type: video/mp4
```
浏览器需要 `--autoplay-policy=no-user-gesture-required`，否则静音也无法自动播放。

**中文文件名 404**
仓库里 `动画.mp4` 是中文名，nginx 默认 UTF-8 即可；若用其它反代/FTP 上传，注意保持文件名不变。

**想换成别的分支 / 私有仓库**
```bash
BRANCH=dev sudo -E /opt/maker/sync.sh
# 私有仓库：用带 token 的地址
REPO_URL=https://<token>@github.com/SCU-Maker-Org/SCU_Maker_Site_Display_Animation.git sudo -E /opt/maker/sync.sh
```
（token 会留在 `/srv/maker/repo/.git/config`，注意权限管理。）

---

## 七、定时开关机（22:30 关机 / 07:00 开机）

```bash
sudo bash deploy/power-schedule.sh install     # 安装（默认 22:30 关机 / 07:00 开机）
sudo bash deploy/power-schedule.sh status      # 查看定时器与 RTC 闹钟
sudo bash deploy/power-schedule.sh test        # 只写一次 RTC 闹钟，不关机
sudo bash deploy/power-schedule.sh uninstall   # 卸载

# 自定义时间
sudo OFF_TIME=22:00 ON_HOUR=6 ON_MIN=30 bash deploy/power-schedule.sh install
```

脚本会创建：

| 单元 | 作用 |
| --- | --- |
| `maker-poweroff.timer` | 每天 22:30 触发 `maker-poweroff.service` |
| `maker-poweroff.service` | 关掉展台浏览器 → 写 RTC 闹钟 → `systemctl poweroff` |
| `maker-rtc-alarm.service` | **每次开机时**写入“下一个 07:00”的 RTC 硬件闹钟 |
| `/usr/local/sbin/maker-rtc-alarm.sh` | 真正写 `/sys/class/rtc/rtc0/wakealarm` 的脚本 |

### 为什么“开机”要用 RTC 闹钟

关机后 CPU 不再运行，任何定时任务（cron / systemd timer）都不会执行。
能按时唤起机器的只有主板上的 **RTC 硬件闹钟**：关机时 RTC 仍由纽扣电池/待机供电，
到点后给电源控制芯片一个唤醒信号。

### 检查它是否真的有效（重要）

```bash
sudo bash deploy/power-schedule.sh test
cat /sys/class/rtc/rtc0/wakealarm            # 应输出一个时间戳
date -d @$(cat /sys/class/rtc/rtc0/wakealarm) # 应显示下一个 07:00
```

- **Linux 侧驱动**：香橙派 Kunpeng Pro（RK3588）板载 RTC 一般是 `rtc-hym8563`。如果 `/dev/rtc0` 存在但没有 `wakealarm`，需要确认内核设备树里给 RTC 节点加了 `wakeup-source;`，或改用 `rtcwake`。
- **硬件/固件侧**：部分开发板的 ACPI/S5 电源在关机后不响应 RTC 闹钟，需要在 BIOS/固件里开启 **RTC Alarm / Wake on RTC / Resume by RTC** 之类选项；香橙派官方镜像通常默认开启。
- 最稳妥的验证方式：设一个 10 分钟后的闹钟，`sudo poweroff`，观察是否能自动开机：

```bash
# 10 分钟后唤醒
sudo rtcwake -m off -l -t "$(date -d '+10 minutes' +%s)"
```

如果 `rtcwake -m off` 能自动开机，而系统自带脚本不行，说明问题只在驱动/权限；反之则是固件不支持。

### 关机后仍保持网络？不需要

RTC 方案关机是**真关机**（功耗接近 0），不是挂起到内存，所以网口断开属正常现象。

### 时间准确性

唤醒时间以 **RTC 时钟**为准。若板子没联网时 NTP 同步过，RTC 可能偏差几分钟：

```bash
timedatectl set-ntp true          # 开机后自动校时
timedatectl                       # 查看 RTC/Synchronized 状态
sudo hwclock --systohc            # 必要时把系统时间写回 RTC
```