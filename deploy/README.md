# SCU Maker 展台 —— 树莓派 4B / 香橙派部署

本目录提供一套「**从 GitHub 定期拉取 → 自动发布 → 失败自动回滚**」的部署方案。

- **当前目标机**：树莓派 4B + **Ubuntu 22.04 LTS**（见第十节）
- 其它可用环境：香橙派 Kunpeng Pro（openEuler）、Debian / Ubuntu 通用

脚本会**自动识别发行版**：有 `apt-get` 就走 apt（Ubuntu/Debian），有 `dnf/yum` 就走对应包管理器；
SELinux 相关步骤只在检测到 `getenforce` 时才执行，Ubuntu 上会自动跳过。

```
deploy/
├── install.sh            一键安装（nginx + 定时更新 + 首次发布；可选定时开关机）
├── sync.sh               拉取/发布/回滚脚本（定时器实际调用它）
├── power-schedule.sh     22:30 关机 / 07:00 RTC 唤醒
├── local-kiosk.sh        不用 nginx：Firefox 全屏打开本地 index.html 的启停脚本
├── autostart.sh          开机自启总览：一键查看/启用/关闭所有 systemd 单元
├── maker-kiosk-run.sh    kiosk 实际启动器（Firefox / Chromium 全屏参数与 profile）
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
---

## 八、openEuler 上「nginx 首页 404」的排查（已内置修复）

香橙派 Kunpeng Pro 出厂多为 **openEuler**，访问 `http://<IP>/` 出现 nginx 的 **404 Not Found**，
99% 是下面三种原因之一。新版 `install.sh` / `sync.sh` 已经自动处理，若你用的是旧脚本或手动部署，按顺序执行：

```bash
# 0. 先确认 404 是谁返回的：nginx 的 404 页面右下角会显示 “nginx/版本号”
#    如果是 "404 Not Found  nginx" 说明是 nginx；如果是 openEuler 页面，说明访问的不是本机 nginx

# 1. 站点是否指向了正确的目录
ls -l /srv/maker/current/            # 应该有 index.html css js 动画.mp4
readlink -f /srv/maker/current       # 应指向 /srv/maker/releases/<版本>
[ -f /srv/maker/current/index.html ] || echo "还没有发布过：运行 sudo /opt/maker/sync.sh"

# 2. 目录权限（/srv 默认 700 会让 nginx 进不去 → 404）
sudo chmod 755 /srv /srv/maker
sudo chmod -R a+rX /srv/maker/releases

# 3. SELinux（openEuler 默认 enforcing，非标准目录会被拒绝访问 → 403/404）
getenforce
sudo dnf install -y policycoreutils-python-utils
sudo semanage fcontext -a -t httpd_sys_content_t "/srv/maker(/.*)?"
sudo restorecon -R /srv/maker

# 4. 配置有没有生效 / 有没有被默认站点覆盖
sudo nginx -T | grep -E "root|server_name|listen"
sudo systemctl restart nginx

# 5. 本机自测（排除浏览器缓存）
curl -I http://127.0.0.1/
```

如果 `curl -I http://127.0.0.1/` 返回 `200` 而浏览器仍 404，就是**浏览器缓存**：
`Ctrl + Shift + R` 强制刷新，或在开发工具里勾选 “Disable cache”。

如果浏览器访问的是 `http:// 192.168.10.8` 这种**带空格**的地址，请确认实际是 `http://192.168.10.8/`。

### 关于同步脚本报 “已是最新版本 c806994，无需更新”

看到这一行说明**代码已经拉下来了**（HEAD 和远端一致），站点目录应该在，只是 nginx 没指对。
说明你的板子上 `sync.sh` 是旧版（缺少 chmod / restorecon 步骤），更新脚本并重新发布：

```bash
cd ~/SCU_Maker_Site_Display_Animation
git pull                                  # 拿到最新 deploy 脚本
sudo install -m 755 deploy/sync.sh /opt/maker/sync.sh
sudo /opt/maker/sync.sh                   # 重新发布（会带上权限与 SELinux 修复）
ls -l /srv/maker/current/
```

---

## 九、不用 nginx：Firefox 直接打开本地 index.html

如果你只想在板子接显示器播放，可以**完全关掉 nginx**，让浏览器直接打开文件：

```
file:///srv/maker/current/index.html?lowfx=1
```

### 9.1 一次性 / 手动方式

```bash
# 让 sync.sh 继续把最新版本同步到 /srv/maker/current（这一步与 nginx 无关）
sudo /opt/maker/sync.sh

# 停掉并禁用 nginx
sudo systemctl disable --now nginx

# 手动用 Firefox 全屏打开
firefox --kiosk "file:///srv/maker/current/index.html?lowfx=1"
```

> 也可以用 `sudo /opt/maker/local-kiosk.sh start` 启动（见下）。

### 9.2 推荐：开机自启（kiosk 服务）

```bash
sudo bash deploy/local-kiosk.sh install     # 安装开机自启（Firefox kiosk）
sudo bash deploy/local-kiosk.sh status      # 查看状态
sudo bash deploy/local-kiosk.sh stop        # 停止
sudo bash deploy/local-kiosk.sh uninstall   # 卸载
```

脚本会：

1. 把 `maker-kiosk-run.sh` 与配置安装到 `/opt/maker/`；
2. 创建专用 Firefox profile（`~/.mozilla/maker-kiosk`），写入「允许静音自动播放」「关欢迎页/遥测」等偏好；
3. 生成 `maker-kiosk.service`，在图形界面启动后自动全屏打开
   `file:///srv/maker/current/index.html?lowfx=1`。

配置文件 `/etc/maker-kiosk.conf`：

```bash
BROWSER=firefox        # 或 chromium
LOWFX=1                # 1 = 加 ?lowfx=1，板子上更省资源
# KIOSK_USER=orangepi  # 默认自动探测桌面用户
```

改完执行 `sudo systemctl restart maker-kiosk`。

### 9.3 nginx 与 file:// 的差别

| | nginx（http://） | 直接打开（file://） |
| --- | --- | --- |
| 局域网其它设备访问 | ✅ 可以 | ❌ 只能本机 |
| 视频 / 图片加载 | 正常（`video/mp4`） | 正常（Chrome 需 `--allow-file-access-from-files`，Firefox 默认可以） |
| 缓存控制 | 可精细控制 | 由浏览器决定，更新后建议重启浏览器 |
| 资源占用 | 多一个 nginx 进程（很小） | 少一个进程 |

> 本项目的视频、图片都是**相对路径**，`file://` 下可以直接加载，无需改代码。
> 但 `file://` 下**不要用 `fetch()` 读配置**——本项目 `config.js` 是普通 `<script>`，不受影响。

### 9.4 更新后怎么生效

`sync.sh` 仍然每 5 分钟把新版本发布到 `/srv/maker/current`，但浏览器已经打开旧页面：

```bash
# 方式一：重启 kiosk（推荐，几秒黑屏）
sudo systemctl restart maker-kiosk

# 方式二：每天凌晨刷新一次
sudo crontab -e
# 加入：
0 4 * * * systemctl restart maker-kiosk
```

如果想做到"更新即刷新"，可以保留 nginx 方案（HTTP 下有 `no-cache` 头，刷新即拿到新内容），
或者用 chromium 的 `--kiosk` + 定时 `xdotool key F5`。

---

## 十、树莓派 4B + Ubuntu 22.04 专用说明

这部分针对 **Raspberry Pi 4B（ARM64）+ Ubuntu 22.04 LTS** 做了适配，与之前的 openEuler 步骤略有不同。

### 10.1 系统准备（一次性）

```bash
# 1) 先确认系统版本
lsb_release -a          # 应为 Ubuntu 22.04.x LTS
uname -m                 # 应为 aarch64

# 2) 更新并安装基础依赖（install.sh 会自动做，这里只是说明装了什么）
sudo apt update
sudo apt install -y nginx git rsync curl ca-certificates

# 3) 时间同步（开机 RTC 闹钟与定时开关机都依赖准确时间）
sudo timedatectl set-timezone Asia/Shanghai
sudo timedatectl set-ntp true
sudo apt install -y systemd-timesyncd
sudo systemctl enable --now systemd-timesyncd
```

### 10.2 部署（和之前一样，一条命令）

```bash
git clone https://github.com/SCU-Maker-Org/SCU_Maker_Site_Display_Animation.git ~/maker-src
sudo bash ~/maker-src/deploy/install.sh
```

Ubuntu 22 上脚本的行为：

| 步骤 | Ubuntu 22 上做什么 |
| --- | --- |
| 依赖 | `apt-get` 安装 `nginx git rsync curl`（不再尝试 `dnf`） |
| nginx 配置 | 写入 `/etc/nginx/sites-available/maker.conf` 并软链到 `sites-enabled`，删除默认站点 |
| SELinux | 检测不到 `getenforce` → **自动跳过**（Ubuntu 默认 AppArmor，不影响 /srv） |
| 防火墙 | 只有装了 `ufw` 且已启用时才 `ufw allow 80/tcp` |
| 定时更新 | `maker-sync.timer`，每 5 分钟 |
| 定时开关机 | 可选，见第七节 |

### 10.3 树莓派 4B 上的性能建议

树莓派 4B 的 GPU 与视频解码能力有限，建议：

1. **用 Chromium 而不是 Firefox**（Chromium 在 Pi 上有硬件解码支持）：
   ```bash
   sudo apt install -y chromium-browser
   sudo sed -i 's/^BROWSER=.*/BROWSER=chromium/' /etc/maker-kiosk.conf
   sudo systemctl restart maker-kiosk
   ```
   `maker-kiosk-run.sh` 已内置 Pi 友好的参数：`--use-gl=egl`（走 V3D 驱动）、
   `--enable-features=VaapiVideoDecoder`、`--disable-dev-shm-usage`（避免 /dev/shm 太小崩掉）。

2. **必须带 `?lowfx=1`**（`local-kiosk.sh` 默认已加），关闭噪点/旋转光环等效果。

3. 视频已经替换成 `assets/动画_web.mp4`（4.3MB / 每 0.5s 关键帧 / Main profile），
   在 Pi 4 上可以流畅解码；如果仍然卡，可再降一档分辨率：
   ```bash
   ffmpeg -i 动画.mp4 -an -vf scale=960:-2 -c:v libx264 -profile:v main -pix_fmt yuv420p \
          -crf 25 -x264-params "keyint=30:min-keyint=30:scenecut=0" \
          -movflags +faststart assets/动画_web.mp4
   ```

4. 建议散热 + 固定 `gpu_mem=128`（`/boot/firmware/config.txt`），并设置 `disable_overscan=1`
   避免边缘黑边。

### 10.4 开机自动登录桌面（kiosk 必需）

Ubuntu 22 默认停在登录界面，kiosk 无法开窗。设置自动登录：

```bash
# GNOME（Ubuntu Desktop 默认）
sudo nano /etc/gdm3/custom.conf
```

取消注释并修改：

```ini
[daemon]
AutomaticLoginEnable=true
AutomaticLogin=你的用户名      # 例如 pi

# 关键：不锁屏
```

再关闭锁屏与空白：

```bash
gsettings set org.gnome.desktop.screensaver lock-enabled false
gsettings set org.gnome.desktop.session idle-delay 0
```

装好后执行：

```bash
sudo bash ~/maker-src/deploy/local-kiosk.sh install   # 开机全屏打开 file://.../index.html?lowfx=1
```

### 10.5 树莓派的定时关机 / 开机

- **关机**：`power-schedule.sh` 的 `maker-poweroff.timer` 在 Ubuntu 22 上同样有效。
- **开机（RTC 唤醒）**：树莓派 4B 的板载 RTC 需要在 `/boot/firmware/config.txt` 中开启：

  ```ini
  # 树莓派 4B 的 RTC（可在 CONFIG 里启用）
  dtparam=rtc=on
  ```

  然后：

  ```bash
  echo "rtc-ds1307 0x51" | sudo tee /etc/modules-load.d/rtc.conf
  sudo reboot
  ls /dev/rtc*                       # 应出现 /dev/rtc0
  cat /sys/class/rtc/rtc0/wakealarm  # 应可读写
  sudo /opt/maker/power-schedule.sh test
  ```

  > 注意：树莓派 4B **没有备用电池**时，断电后 RTC 会归零；但 `poweroff` 后主板仍保持待机供电，
  > RTC 闹钟可以正常触发唤醒。若必须断电存放，需要给 RTC 外接 CR2032。

- 验证：

  ```bash
  sudo rtcwake -m off -l -t "$(date -d '+10 minutes' +%s)"   # 10 分钟后应自动开机
  ```

### 10.6 已弃用的 openEuler 专属步骤

如果你从香橙派（openEuler）迁过来，以下内容**在 Ubuntu 上不会再执行**，无需处理：

- `dnf / yum` 安装分支（脚本会优先走 `apt-get`）
- `setsebool / semanage / restorecon`（检测不到 SELinux 自动跳过）
- `firewall-cmd`（Ubuntu 用 `ufw`，脚本也会自动识别）

---

## 十一、常见报错速查（Ubuntu / 树莓派）

### `nginx: [emerg] "worker_processes" directive is not allowed here`

**原因**：`worker_processes / events{} / http{}` 属于**主配置**指令，只能出现在 `/etc/nginx/nginx.conf`。
而 `/etc/nginx/sites-enabled/*` 是被 `nginx.conf` 里的 `include` 到 `http{}` 内部的，
放进去就会报这个错。

**修复**：把站点文件换成只有 `server{}` 的片段（仓库里的 `deploy/nginx-maker.conf` 已经是这个格式）：

```bash
# 1) 删掉坏掉的链接与文件
sudo rm -f /etc/nginx/sites-enabled/maker.conf /etc/nginx/sites-available/maker.conf

# 2) 重新写入正确片段（仓库里的新版）
cd ~/SCU_Maker_Site_Display_Animation      # 或你的仓库目录
git pull
sudo install -m 644 deploy/nginx-maker.conf /etc/nginx/sites-available/maker.conf
sudo ln -sfn /etc/nginx/sites-available/maker.conf /etc/nginx/sites-enabled/maker.conf

# 3) 删掉默认站点（避免两个 default_server 冲突）
sudo rm -f /etc/nginx/sites-enabled/default

# 4) 检查并重启
sudo nginx -t && sudo systemctl restart nginx
```

实际上**重新跑一遍 `sudo bash deploy/install.sh` 就会自动清理并修复**，
脚本现在会：删除旧的 `sites-enabled/maker.conf` 与 `conf.d/maker.conf`、写入正确片段、
`nginx -t` 失败时自动回滚，不会再留下坏配置。

### 其他常见报错

| 报错 | 原因 | 处理 |
| --- | --- | --- |
| `duplicate default server ...` | 默认站点还在 | `sudo rm -f /etc/nginx/sites-enabled/default` |
| `listen [::]:80 ... address already in use` | 80 端口被占用 | `sudo ss -lntp \| grep :80`，停掉占用的服务 |
| 浏览器 403 / 空页面 | 目录权限或路径不对 | `ls -l /srv/maker/current/`，`sudo chmod 755 /srv /srv/maker` |
| `nginx: [emerg] unknown directive "listen"` | 片段被放在了 `nginx.conf` 外层 | 确认文件在 `sites-enabled/` 而非 `nginx.conf` 末尾追加 |

---

## 十二、树莓派 Ubuntu 22：部署后 404 排查（按顺序做一遍）

安装脚本最后会打印 `访问地址 : http://<IP>/`，但出现 **404 Not Found** 时，请依次执行，
基本能定位到原因：

### 步骤 1：确认页面文件是否真的发布了

```bash
ls -l /srv/maker/current/
readlink -f /srv/maker/current          # 应指向 /srv/maker/releases/<版本>
[ -f /srv/maker/current/index.html ] && echo "index.html 存在" || echo "没有内容，先跑 sudo /opt/maker/sync.sh"
```

如果 `current` 指向的目录里**没有 index.html**，说明同步没成功：

```bash
sudo /opt/maker/sync.sh                 # 看输出，应显示“已发布 …”
tail -n 30 /srv/maker/logs/sync.log
```

> 常见原因：仓库里没有那两个根目录图片（`SCU Maker's Logo.png`、`校徽+院徽（高清+抠图版）.png`），
> 新版 `sync.sh` 已把它们加入必需文件校验，缺了会直接报错而不是发布半套。

### 步骤 2：确认 nginx 用的就是这个目录

```bash
sudo nginx -T | grep -E "server_name|root |listen " | head -20
```

应能看到 `root /srv/maker/current;` 和 `listen 80 default_server;`。
如果没有任何输出或还是默认站点，重跑一次安装：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
cd ~/Desktop/SCU_Maker_Site_Display_Animation && git pull
sudo bash deploy/install.sh
```

### 步骤 3：本机自测（排除浏览器/网络因素）

```bash
curl -I http://127.0.0.1/                  # 应为 HTTP/1.1 200 OK
curl -s http://127.0.0.1/ | head -5        # 应看到 <!DOCTYPE html>
```

- `200` 但浏览器 404 → **浏览器缓存或输错地址**，`Ctrl+Shift+R` 强刷。
- `403` → 目录权限：`sudo chmod 755 /srv /srv/maker && sudo chmod -R a+rX /srv/maker/releases`
- `404` 且 `/srv/maker/current/index.html` 存在 → 看 `/var/log/nginx/error.log`：

```bash
sudo tail -n 30 /var/log/nginx/error.log
```

常见的是 `open() "/srv/maker/current/index.html" failed (13: Permission denied)`——
Ubuntu 的 nginx 以 `www-data` 运行，`/srv` 默认 755 通常没问题，但如果之前 `chmod 700` 过就要改回。

### 步骤 4：局域网其它设备访问不了

```bash
sudo ss -lntp | grep :80                # nginx 是否在监听 0.0.0.0:80
sudo ufw status                         # 若启用 ufw，需 sudo ufw allow 80/tcp
ip addr show | grep "inet "             # 确认板子的 IP（打印的地址取的是第一个网卡）
```

树莓派常见情况：同时有 `wlan0` 和 `eth0`，脚本打印的可能是**另一个网段的 IP**，
以你实际要访问的那块网卡的 IP 为准。

### 步骤 5：页面能开但顶栏图片/视频 404

```bash
ls -l "/srv/maker/current/SCU Maker's Logo.png" "/srv/maker/current/校徽+院徽（高清+抠图版）.png"
ls -l /srv/maker/current/assets/
```

缺少就说明发布时没同步到（旧版 `sync.sh` 会漏掉根目录图片），更新脚本后重新发布：

```bash
cd ~/Desktop/SCU_Maker_Site_Display_Animation && git pull
sudo install -m 755 deploy/sync.sh /opt/maker/sync.sh
sudo /opt/maker/sync.sh --force
```

> `sync.sh` 只有在检测到新 commit 时才会重新发布；如果只是修了脚本、仓库没变，
> 可以先 `sudo rm -rf /srv/maker/releases/*` 再跑一次，或直接手动更新软链接。

---

## 十三、开机自启总览（哪些东西会随开机自动运行）

### 会自动启动的组件

| 组件（systemd 单元） | 什么时候装 | 开机后做什么 |
| --- | --- | --- |
| `nginx` | `install.sh` | 监听 80 端口，提供 `http://<IP>/`（局域网其它设备可访问） |
| `maker-sync.timer` | `install.sh` | 开机 1 分钟后开始，**每 5 分钟**从 GitHub 检查更新并自动发布 |
| `maker-kiosk.service` | 执行 `local-kiosk.sh install` 后 | 等桌面起来后**全屏打开页面**（本机显示器用） |
| `maker-poweroff.timer` | 执行 `power-schedule.sh install` 后 | 每天 **22:30 关机** |
| `maker-rtc-alarm.service` | 同上 | 每次开机写 RTC 闹钟，**07:00 自动开机** |

### 一条命令查看 / 开关

```bash
sudo /opt/maker/autostart.sh status     # 每项是否“开机自启 / 当前运行”
sudo /opt/maker/autostart.sh enable     # 全部启用并立即启动
sudo /opt/maker/autostart.sh disable    # 全部关闭开机自启（不会停止正在运行的进程）
```

可选参数：

```bash
# 连“全屏 kiosk”一起装上（没装过 maker-kiosk.service 时用它）
sudo /opt/maker/autostart.sh enable --with-kiosk

# 只用 file:// 本机播放、不需要 nginx
sudo /opt/maker/autostart.sh enable --no-nginx
```

`status` 输出示例：

```
组件                         开机自启      当前状态
---------------------------- --------     --------
nginx                        enabled      active
maker-sync.timer             enabled      active
maker-kiosk.service          enabled      active
maker-poweroff.timer         enabled      active
maker-rtc-alarm.service      enabled      active
```

### 两种播放方式可以并存

- **本机显示器**：`maker-kiosk.service` 用 `file:///srv/maker/current/index.html?lowfx=1` 全屏
- **局域网其它设备**：`nginx` 提供 `http://<IP>/`

两者读的是同一个 `current` 目录，所以只装一个 `sync.sh` 就能同时更新。

### 单独控制某一项

```bash
sudo systemctl status nginx
sudo systemctl disable --now nginx          # 关掉并停止
sudo systemctl enable  --now maker-sync.timer
sudo systemctl list-timers 'maker-*'        # 看所有 maker 定时器
```

### 常见疑问

**Q：开机后要等多久页面才会出来？**
A：nginx 与 sync 在系统启动阶段就跑；kiosk 依赖图形桌面，脚本默认等 `KIOSK_DELAY=8` 秒；
如果自动登录慢，把 `/etc/maker-kiosk.conf` 里的 `KIOSK_DELAY` 调到 15~20。

**Q：断电重启后页面还是旧的？**
A：`maker-sync.timer` 开机 1 分钟后才第一次检查；急的话 `sudo /opt/maker/sync.sh`。
kiosk 浏览器打开的是本地 `current`，更新后需要 `sudo systemctl restart maker-kiosk` 才会刷新画面。

---

## 十四、开机立刻全屏打开页面（推荐配置）

目标：**按下电源 → 自动登录桌面 → 桌面一出现就全屏打开展示页**，中间不需要任何点击。

### 一条命令完成

```bash
# 在仓库目录执行
cd ~/Desktop/SCU_Maker_Site_Display_Animation
git pull
sudo install -m 755 deploy/local-kiosk.sh /opt/maker/local-kiosk.sh
sudo install -m 755 deploy/maker-kiosk-run.sh /opt/maker/maker-kiosk-run.sh
sudo /opt/maker/local-kiosk.sh install
```

它会依次完成：

1. 写入 `/etc/maker-kiosk.conf`（浏览器、`?lowfx=1`、`file://` 或 `http://`）；
2. 创建**桌面自启项** `~/.config/autostart/maker-kiosk.desktop`
   —— 桌面会话一就绪就启动，比 systemd 快几秒，也不会遇到权限/DISPLAY 问题；
3. **自动开启 GDM 自动登录**（`/etc/gdm3/custom.conf` 写入 `AutomaticLoginEnable=true` + 用户名，改前自动备份）；
4. 立刻启动一次，不用等重启。

安装后检查：

```bash
sudo /opt/maker/local-kiosk.sh status
```

输出里应能看到：

```
== 自启方式 ==
  桌面自启：/home/xxx/.config/autostart/maker-kiosk.desktop
== 浏览器进程 ==
  1234  chromium --kiosk --incognito ... file:///srv/maker/current/index.html?lowfx=1
== 自动登录 ==
AutomaticLoginEnable=true
AutomaticLogin=xxx
```

### 为什么用“桌面自启”而不是 systemd

Ubuntu 22 的桌面（GDM + GNOME/Wayland）在 systemd 的 `graphical.target` 之后还要几秒才真正可用，
此时 `DISPLAY=:0` 还不存在，systemd 直接拉浏览器会失败或黑屏。
桌面自启（`~/.config/autostart/*.desktop`）是**桌面会话自己**启动的程序，时机最准。

如果你更想用 systemd：

```bash
sudo /opt/maker/local-kiosk.sh install --systemd
```

（它会创建 `maker-kiosk.service`，`WantedBy=graphical.target`，失败自动重启。）

### 两种页面地址

`/etc/maker-kiosk.conf`：

```bash
VIEW=file    # file:///srv/maker/current/index.html?lowfx=1   ← 默认，不依赖 nginx
VIEW=http    # http://127.0.0.1/?lowfx=1                       ← 配合 nginx
BROWSER=chromium        # chromium / chromium-browser / firefox（写错也会自动兜底）
LOWFX=1                 # 1 = 加 ?lowfx=1，树莓派 4B 上明显更流畅
KIOSK_DELAY=0           # 桌面就绪后额外等待秒数
```

改完执行 `sudo /opt/maker/local-kiosk.sh stop && sudo /opt/maker/local-kiosk.sh start` 生效。

### 常用命令

```bash
sudo /opt/maker/local-kiosk.sh status      # 页面/自启/进程/自动登录 全在这
sudo /opt/maker/local-kiosk.sh start       # 立刻打开（不开机重启也能测）
sudo /opt/maker/local-kiosk.sh stop        # 关掉播放器（维护时用）
sudo /opt/maker/local-kiosk.sh uninstall   # 移除自启（页面文件保留）
```

### 常见问题

**Q：开机后停在登录界面？**
A：自动登录没生效。检查 `grep ^AutomaticLogin /etc/gdm3/custom.conf`，
或重跑 `sudo /opt/maker/local-kiosk.sh install`（它会自动写入并备份原文件）。

**Q：桌面出来了但没全屏？**
A：`--kiosk` 参数缺失或被浏览器忽略。手动验证：

```bash
chromium --kiosk "file:///srv/maker/current/index.html?lowfx=1"
firefox  --kiosk "file:///srv/maker/current/index.html?lowfx=1"
```

能全屏说明参数没问题，检查 `/etc/maker-kiosk.conf` 的 `BROWSER=` 是否写成了实际存在的命令。

**Q：Wayland 下 kiosk 有问题？**
A：登录界面右上角齿轮切换到 “Ubuntu on Xorg”，或设置
`/etc/gdm3/custom.conf` 中 `WaylandEnable=false`。

**Q：播放器更新了页面却还是旧的？**
A：kiosk 打开的是本地文件，更新后需要重启播放器：

```bash
sudo /opt/maker/local-kiosk.sh stop && sudo /opt/maker/local-kiosk.sh start
```

可以加到 crontab 每天凌晨刷新一次：`0 4 * * * /opt/maker/local-kiosk.sh stop && sleep 2 && /opt/maker/local-kiosk.sh start`