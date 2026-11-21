# SCU Maker 协会 · 展示墙动画

一个**纯静态**的网页展示动画：不用装任何东西、不用开服务器，双击 `index.html` 全屏播放即可。

- **第 1 页（开场）**：Logo 色块硬切（米白 / 院徽蓝 / 夜黑 / 院徽金 / 川大红 / 优雅灰）→ 播放 `动画.mp4` → **3 秒黑场过渡** → Logo 浮现，停留 10 秒
- **第 2 页起（海报）**：每个活动自动生成 **中文页 + 英文页** 两张，横向切换、自动循环
- 配色取自**四川大学计算机学院院徽**：院徽蓝 `#4667ad`、浅钢蓝 `#7aa8e8`、院徽金 `#f7bd00`，整体浅色纸面
- 左上角只在**海报页**显示协会 Logo（开场页整屏就是 Logo，不再重复）

预览：

![Logo 色块快切](preview/01-logo-cuts.png)
![川大红配色](preview/01b-logo-red.png)
![开场动画：猫与无人机](preview/02-anim-drone.png)
![开场动画：奔跑](preview/03-anim-run.png)
![Logo 落位](preview/04-logo-final.png)
![中文海报](preview/05-poster-zh.png)
![英文海报](preview/06-poster-en.png)

---

## 一、怎么用

1. 双击 `index.html`（推荐 **Chrome / Edge**，不推荐 IE）。
2. 按 `F` 进入全屏，展台就绪。
3. 默认自动播放：开场约 17 秒 → 每张海报 9 秒 → 循环。

> 全屏、自动播放都可以在 `js/config.js` 里开关；如果希望一打开就全屏，把
> `fullscreenOnStart` 设为 `true`（浏览器可能要求先点一下页面才允许全屏）。

### 播放控制

| 操作 | 效果 |
| --- | --- |
| `→` / `↓` / `PageDown` / 鼠标滚轮下 / 右侧箭头 | 下一页 |
| `←` / `↑` / `PageUp` / 滚轮上 / 左侧箭头 | 上一页 |
| `空格` / 右上角按钮 | 暂停 / 继续 |
| `F` | 全屏切换 |
| `R` | 重播当前页 |
| `1`–`9` | 直接跳到第 N 页 |
| 底部圆点 | 点击跳页 |
| 手机 / 触摸屏 | 左右滑动 |

鼠标闲置 2 秒后光标自动隐藏，方便展台。

---

## 二、文件结构

```
index.html                  页面骨架（一般不用改）
css/style.css               所有样式与配色
js/config.js                ★ 你只需要改这个
js/intro.js                 第一页：Logo 快切 + 播放 动画.mp4 + Logo 落位
js/poster.js                海报页生成器（中 / 英双语）
js/app.js                   播放控制：横移、循环、进度、快捷键
动画.mp4                    开场动画视频（1280×720，可替换）
deploy/                     香橙派部署脚本（定时拉取 / nginx / 22:30关机·07:00开机，见 deploy/README.md）
assets/、tools/             （上一版分层猫动画的素材，当前未使用，可删）
敲钉子的猫.png / 哈气的猫.png  原始插画（素材备份）
SCU Maker's Logo.png        协会 Logo（透明底 PNG）
校徽+院徽（高清+抠图版）.png   校徽 + 院徽（左上角排在最前）
preview/                    预览截图
```

---

## 三、替换内容（`js/config.js`）

### 1）全局设置

```js
settings: {
  autoPlay: true,              // 自动播放
  loop: true,                  // 循环
  fullscreenOnStart: false,    // 打开后自动全屏
  showIntroOnce: false,        // true = 只在第一轮播开场，之后循环跳过
  logoImage: "SCU Maker's Logo.png",          // 协会 Logo（排在院徽后面）
  emblemImage: "校徽+院徽（高清+抠图版）.png",   // 左上角排在最前面的校徽 + 院徽
  brandBlue: '#4667ad',
  brandGold: '#f7bd00',
}
```

左上角依次是 **校徽 + 院徽**、**协会 Logo**，两者都可以在 `settings.emblemImage` / `settings.logoImage` 里换图。

**换 Logo**：把透明底、正方形、黑色图形的 PNG 放到 `index.html` 同目录，
把 `logoImage` 改成文件名即可。开场里「白底黑 Logo / 蓝底白 Logo / 黑底白 Logo」
靠 CSS `invert` 自动反色，不用准备两版。

### 2）第一页：Logo 快切 + 开场视频

开场的色块仍然在 `intro.cuts` 里配（每项 `ms` 是停留时长），随后播放视频：

```js
intro: {
  video: '动画.mp4',        // 视频放在 index.html 同目录；换视频只改这里
  duration: 28500,          // 只是初始值，实际时长 = 色块 + 视频时长 + 10s 自动算
  mainTitle: 'SCU Maker',
  subTitle: '四川大学计算机学院（软件学院）开源硬件协会',
  kicker: 'Sichuan University · College of Computer Science',
  cuts: [
    { bg: '#f7f4ec', logo: 'black', ghost: 'SCU MAKER', ms: 520 },
    { bg: '#4667ad', logo: 'white', ghost: 'MAKER',     ms: 500 },
    { bg: '#0a0f22', logo: 'white', ghost: 'SCU MAKER', ms: 500 },
    { bg: '#f7bd00', logo: 'black', ghost: 'MAKER',     ms: 500 },
    { bg: '#b1281c', logo: 'white', ghost: 'SICHUAN',   ms: 460 },  // 川大红
    { bg: '#9a9ea6', logo: 'white', ghost: 'MAKER',     ms: 460 },  // 优雅灰
    { bg: '#f7f4ec', logo: 'black', ghost: 'SCU MAKER', ms: 520 }
  ],
  lines: [ { text: 'Turn ideas into reality.' }, ... ]   // Logo 落位后的打字机文案
}
```

> 视频会静音自动播放（浏览器要求）；想保留原声，把 `js/intro.js` 里 `<video ... muted ...>` 的 `muted` 去掉，并改由用户点击后播放。
### 3）海报页：每个活动写一份中文 + 一份英文

`posters` 是数组，**一个对象自动变成两页**（先中文、后英文），页码、进度条自动增加。

公共字段（两种语言共用）：

| 字段 | 说明 |
| --- | --- |
| `date` | 日期，如 `2026.11.22`（与 `time` 合成一行显示） |
| `weekday` / `weekdayEn` | 中文星期 / 英文星期 |
| `color` | 本活动强调色（默认院徽金） |
| `duration` | 这一页停留毫秒（中英两页共用） |
| `image` | 海报主图路径，留空显示 Logo 水印 |
| `qr` | 报名二维码图片路径，留空不显示 |

`zh` / `en` 里各放这一种语言的全部文字（标签与分类在同一行；底部时间栏自动拼成「2026年11月22日14:00-17:00」）：

> 右侧海报图右下角的大号数字是**活动序号**（第几个活动），中英两页显示同一个数字；底部进度条旁的页码才是当前第几页。

> 长期举办、没有具体日期的活动：把 `date` 留空，时间栏就只显示 `time` 这一行（例如中文 `time: '长期举行'`、英文 `time: 'Ongoing · regular sessions'`）。

```js
{
  date: '2025.11.22', weekday: '周六', weekdayEn: 'Sat',
  color: '#f7bd00', duration: 9000, image: '', qr: '',

  zh: {
    tag: '创客工坊',                    // 左上角标签（中文页用中文）
    category: '第 07 期 · 小猫灯制作',   // 与标签同一行
    title: '从 0 到 1：做一个会发光的小猫灯',   // **文字** 可加金色下划线
    speaker: '李思远',
    speakerTitle: 'SCU Maker 技术部部长 / 单片机爱好者',
    time: '14:00 — 17:00',      // 与 date 合成「2026年11月22日14:00-17:00」
    place: '四川大学江安校区 · 计算机学院实验中心 B302',
    description: '……',
    highlights: ['零基础可参加', '工具与材料现场提供', '作品可带走'],
    entry: '免费 · 需提前报名',
    qrText: '扫码报名 · 限 30 人'
  },

  en: {
    tag: 'WORKSHOP',
    category: 'Vol. 07 · Cat Lamp Build',
    title: 'From Zero to One: Build a Glowing Cat Lamp',
    speaker: 'Li Siyuan',
    speakerTitle: 'Head of Tech, SCU Maker · Microcontroller enthusiast',
    time: '14:00 – 17:00',
    place: 'Lab Center B302, College of Computer Science, Jiang'an Campus, SCU',
    description: '……',
    highlights: ['No experience needed', 'Tools & materials provided', 'Take your build home'],
    entry: 'Free · RSVP required',
    qrText: 'Scan to register · 30 seats'
  }
}
```

> 版式规则：中文页只出现中文，英文页只出现英文；底部不显示 TIME / LOCATION / ENTRY
> 这类英文小标签，信息与图标垂直居中对齐，时间显示为「2026年11月22日14:00-17:00」。

路径相对于 `index.html`，建议英文文件名、不要带空格。

---

## 四、第一页是怎么播放的

1. **色块硬切**：HTML 层直接切换背景色，黑色 Logo 用 `invert` 反成白色；共 7 刀（含川大红、优雅灰）。
2. **视频**：色块结束时开始播放 `动画.mp4`（muted + playsinline 自动播放），铺满画面（`object-fit: cover`）。
3. **结束**：**视频最后 1.5 秒就开始缓慢压黑**（sine 缓入缓出，与画面重叠）→ 视频播完时正好全黑，Logo 已就位 → 黑场**渐退**（1.2s，cubic 缓入缓出）露出纸面 + Logo，随后标题与打字机文案出现。
4. **停留**：Logo 停留 10 秒后自动翻到第一张海报。

时长是自动算的：`色块总时长 + 视频时长 + 黑场退去 1.5 秒 + 10 秒`（压黑与视频尾巴重叠，不额外占时间），进度条也会跟着更新，所以换一个不同长度的视频不用改任何时间配置。

---

## 五、常见问题

**Q：打开是白屏？**
A：确认 `index.html` 和 `css/`、`js/` 在同一目录；用 Chrome / Edge 打开；按 `F12` 看 Console 是否有报错。

**Q：Logo 不显示？**
A：检查 `settings.logoImage` 的文件名与实际文件名完全一致（含空格、单引号）。Logo 应为透明底 PNG。

**Q：海报里的图片不显示？**
A：路径要相对 `index.html`，且文件名不要含中文或空格；注意大小写。

**Q：海报只想要中文 / 只想要英文？**
A：删掉 `js/app.js` 里 `['zh','en']` 中的一项即可（例如改成 `['zh']`），或把 `en` 里的内容改成中文。

**Q：想改配色？**
A：`css/style.css` 顶部 `:root` 里的 `--blue`、`--blue-2`、`--gold`、`--paper` 就是全部主题色；
`js/config.js` 的 `brandBlue` / `brandGold` 会覆盖前两个。

**Q：投影仪是 4:3 或异形比例？**
A：页面按屏幕自适应；第一页画板会等比缩放居中，海报页会切换为单列布局。

**Q：循环时不想每次都播开场？**
A：把 `showIntroOnce` 设为 `true`。
