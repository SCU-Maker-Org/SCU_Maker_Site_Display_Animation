/* ============================================================================
 *  SCU Maker · 协会展示动画  —  配置文件（你只需要改这一个文件）
 * ----------------------------------------------------------------------------
 *  1. settings  全局设置：Logo 路径、院徽配色、自动播放
 *  2. intro     第一页：Logo 色块快切 + 猫猫工作台动画
 *  3. posters   每个活动一个对象 → 自动生成「中文页 + 英文页」两张
 * ========================================================================== */

window.CONFIG = {

  /* ------------------------------------------------------------------------
   * 1) 全局设置
   * ---------------------------------------------------------------------- */
  settings: {
    autoPlay: true,               // 自动循环播放
    loop: true,                   // 播完最后一页回到第一页
    fullscreenOnStart: false,     // 打开后自动全屏（部分浏览器需用户手势）
    showIntroOnce: false,         // true = 只在第一轮播开场，之后循环跳过

    logoImage: "SCU Maker's Logo.png",   // 协会 Logo（与 index.html 同目录）
    emblemImage: '校徽+院徽（高清+抠图版）.png',  // 左上角排在前面的校徽 + 院徽
    brandBlue: '#4667ad',         // 院徽主蓝
    brandGold: '#f7bd00',         // 院徽金
  },

  /* ------------------------------------------------------------------------
   * 2) 第一页 · 开场
   *    流程：Logo 色块硬切（含川大红 / 优雅灰）→ 敲钉子 → 螺丝刀 → 开心 → 哈气
   *          （每个小猫 1.5s）→ 闪白 → Logo 落位
   *
   *    cuts 里每一项就是一刀（不做过渡动画，直接换色）：
   *      bg     背景色
   *      logo   'black' 黑色 Logo / 'white' 白色 Logo
   *      ghost  背景上巨大的浅色字
   *      ms     这一刀停留多久（毫秒），后面的猫猫动画会自动顺延
   * ---------------------------------------------------------------------- */
  intro: {
    duration: 40700,              // 开场：动画约 9.7s + Logo 停留 10s，然后翻页
    mainTitle: 'SCU Maker',
    subTitle: '四川大学计算机学院（软件学院）开源硬件协会',
    kicker: 'Sichuan University · College of Computer Science',

    // Logo 色块快切
    cuts: [
      { bg: '#f7f4ec', logo: 'black', ghost: 'SCU MAKER', ms: 520 },  // 米白底 · 黑 Logo
      { bg: '#4667ad', logo: 'white', ghost: 'MAKER', ms: 500 },  // 院徽蓝 · 白 Logo
      { bg: '#0a0f22', logo: 'white', ghost: 'SCU MAKER', ms: 500 },  // 夜黑底 · 白 Logo
      { bg: '#f7bd00', logo: 'black', ghost: 'MAKER', ms: 500 },  // 院徽金 · 黑 Logo
      { bg: '#b1281c', logo: 'white', ghost: 'SICHUAN', ms: 460 },  // 川大红 · 白 Logo
      { bg: '#9a9ea6', logo: 'white', ghost: 'MAKER', ms: 460 },  // 优雅灰 · 白 Logo
      { bg: '#f7f4ec', logo: 'black', ghost: 'SCU MAKER', ms: 520 }   // 回到纸面
    ],

    // 落定后的打字机文案轮播
    lines: [
      { text: 'Turn ideas into reality.' },
      { text: 'We think. We design. We make.' }
    ]
  },

  /* ------------------------------------------------------------------------
   * 3) 活动海报：每个活动 = 中文页 + 英文页
   * ------------------------------------------------------------------------
   *  公共字段（两种语言共用）：
   *      date / weekday / weekdayEn / color / duration / image / qr
   *  zh / en 里各自放这一种语言的全部文字：
   *      tag（左上角标签）, category（同行小字）, title,
   *      speaker, speakerTitle, time, place, description,
   *      highlights[], entry, qrText, speakerAvatar(可选)
   *
   *  · 底部时间栏 = 日期 + 时段，自动拼成「2026年11月22日14:00-17:00」这样的格式。
   *  · title 里用 **文字** 可以加金色下划线强调。
   *  · 想加活动：复制一整个 { ... } 对象即可，页码与进度条会自动增加。
   * ---------------------------------------------------------------------- */
  posters: [

    {
      date: '2026.11.22',
      weekday: '周六',
      weekdayEn: 'Sat',
      color: '#f7bd00',
      duration: 10000,
      image: '',
      qr: '',

      zh: {
        tag: '创客工坊',
        category: '第 07 期 · 小猫灯制作',
        title: '从 0 到 1：做一个会发光的小猫灯',
        speaker: '李思远',
        speakerTitle: 'SCU Maker 技术部部长 / 单片机爱好者',
        speakerAvatar: '',
        time: '14:00 — 17:00',
        place: '四川大学江安校区 · 计算机学院实验中心 B302',
        description: '一把螺丝刀、一颗 LED、一块单片机，就能让一只小猫在夜里眨眼睛。带你从电路搭建、焊接、编写控制程序到外壳打磨，亲手完成属于自己的桌面小夜灯。',
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
        speakerAvatar: '',
        time: '14:00 – 17:00',
        place: 'Lab Center B302, College of Computer Science, Jiang\'an Campus, SCU',
        description: 'A screwdriver, an LED and a microcontroller are all it takes to make a little cat blink in the dark. Build the circuit, solder it, write the firmware and finish the shell — leave with your own desk lamp.',
        highlights: ['No experience needed', 'Tools & materials provided', 'Take your build home'],
        entry: 'Free · RSVP required',
        qrText: 'Scan to register · 30 seats'
      }
    },

    {
      date: '2026.12.06',
      weekday: '周六',
      weekdayEn: 'Sat',
      color: '#7aa8e8',
      duration: 10000,
      image: '',
      qr: '',

      zh: {
        tag: '前辈沙龙',
        category: '计算机视觉 × 生成模型',
        title: '在图像里寻找光：扩散模型与创意工具',
        speaker: '汪 清',
        speakerTitle: '计算机学院副教授 / 计算机视觉方向',
        speakerAvatar: '',
        time: '19:00 — 21:00',
        place: '四川大学江安校区 · 一号教学楼 A101 报告厅',
        description: '从一张草图到一幅作品，扩散模型如何理解“光”与“美”？本次沙龙将拆解生成模型的原理脉络，并聊聊它如何融入创作者的日常工具链。',
        highlights: ['现场演示', '开放问答'],
        entry: '免费入场 · 现场签到',
        qrText: '扫码报名 · 现场签到'
      },

      en: {
        tag: 'SHARING',
        category: 'Computer Vision × Generative Models',
        title: 'Finding Light in Images: Diffusion Models & Creative Tools',
        speaker: 'Wang Qing',
        speakerTitle: 'Associate Professor, Computer Vision',
        speakerAvatar: '',
        time: '19:00 – 21:00',
        place: 'Lecture Hall A101, Teaching Building 1, Jiang\'an Campus, SCU',
        description: 'From a rough sketch to a finished artwork — how do diffusion models understand light and beauty? We break down how generative models work, and how they fit into a creator\'s everyday toolkit.',
        highlights: ['Live demo', 'Open Q&A'],
        entry: 'Free entry · Check in on site',
        qrText: 'Scan to register'
      }
    },

    {
      date: '2026.12.20',
      weekday: '周六',
      weekdayEn: 'Sat',
      color: '#f7bd00',
      duration: 10000,
      image: '',
      qr: '',

      zh: {
        tag: '创客马拉松',
        category: '48 小时 · 自由组队',
        title: '造物马拉松：猫的 48 小时',
        speaker: '全体理事',
        speakerTitle: 'SCU Maker 理事团队',
        speakerAvatar: '',
        time: '09:00-次日 21:00',
        place: '四川大学江安校区 · 工程训练中心 创客空间',
        description: '48 小时组队、选主题、做原型、路演。硬件、软件、设计、机械可自由组队；现场提供 3D 打印机、激光切割机、电子元件与全天候咖啡。',
        highlights: ['自由组队 2–4 人', '设备与耗材全提供', '最佳作品入驻学院展厅'],
        entry: '免费 · 自由组队',
        qrText: '扫码组队报名'
      },

      en: {
        tag: 'HACKATHON',
        category: '48 Hours · Team Up',
        title: 'Make-a-Thon: 48 Hours of Cats',
        speaker: 'SCU Maker Board',
        speakerTitle: 'The SCU Maker organizing team',
        speakerAvatar: '',
        time: '09:00-next day 21:00',
        place: 'Maker Space, Engineering Training Center, Jiang\'an Campus, SCU',
        description: 'Team up, pick a theme, build a prototype and pitch it — all in 48 hours. Hardware, software, design and mechanical makers welcome. 3D printers, laser cutters, electronics and coffee provided.',
        highlights: ['Teams of 2–4', 'Equipment & materials provided', 'Best work shown at the college'],
        entry: 'Free · Form a team',
        qrText: 'Scan to form a team'
      }
    }

  ]
};
