/* ============================================================================
 *  海报页 · 由 CONFIG.posters 自动生成
 *  每个活动生成两页：lang='zh' 纯中文 / lang='en' 纯英文
 *  版式：标签+分类同一行；标题；主讲人；简介；标签
 *  底部：时间（日期+星期+时段）/ 地点 / 入场方式（无英文标签）
 * ========================================================================== */
(function () {
  'use strict';

  var ICON = {
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3.2 1.9"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s6.5-5.6 6.5-10.4A6.5 6.5 0 0 0 5.5 10.6C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.4" r="2.4"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M3.5 8.5V6.5h17v2a2.2 2.2 0 0 0 0 4.4v4.6h-17v-4.6a2.2 2.2 0 0 0 0-4.4z"/><path d="M9 9.6h6M9 13h6"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rich(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<span class="hl">$1</span>');
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // 把 2026.11.20 / 2026-11-20 / 2026/11/20 解析成年月日
  function parseDate(str) {
    var m = /(\d{4})\D+(\d{1,2})\D+(\d{1,2})/.exec(String(str || ''));
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3] };
  }
  function dateZh(str) {
    var p = parseDate(str);
    return p ? p.y + '年' + p.m + '月' + p.d + '日' : String(str || '');
  }
  function dateEn(str) {
    var p = parseDate(str);
    return p ? MONTHS[p.m - 1] + ' ' + p.d + ', ' + p.y : String(str || '');
  }
  // 统一时段写法：14:00 — 17:00 → 14:00-17:00
  function normTime(t) {
    return String(t || '')
      .replace(/\s*[—–]\s*/g, '-')
      .replace(/\s*-\s*/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /**
   * @param {object} p     config.posters 里的一项（一个活动）
   * @param {number} index 第几个活动（0 起，中英两页共用同一个编号）
   * @param {string} lang  'zh' | 'en'
   */
  function PosterSlide(p, index, lang) {
    var common = p || {};
    var d = Object.assign({}, common, (common[lang] || {}));
    var isEn = lang === 'en';
    var no = pad(index + 1);   // 活动序号，中英双语页显示同一个数字
    var accent = d.color || '#f7bd00';
    var duration = d.duration || 9000;
    var speaker = d.speaker || '';
    // 时间栏 = 日期 + 时段 + 星期，缺哪个就跳过，不会出现多余的分隔符
    //   长期活动：date='' 、weekday='长期'  →  只显示「长期」
    //   单次活动：date + weekday + time    →  「2026年11月22日周日19:00-21:00」
    var parts = [];
    if (d.date) parts.push(isEn ? dateEn(d.date) : dateZh(d.date));
    var wk = isEn ? (d.weekdayEn || '') : (d.weekday || '');
    var tm = normTime(d.time);
    if (wk && tm && (wk === tm || tm.indexOf(wk) === 0)) wk = '';   // 星期已包含在时段里就不重复
    if (wk) parts.push(wk);
    if (tm) parts.push(tm);
    var timeFull = parts.join(isEn ? ' · ' : '');


    var el = document.createElement('section');
    el.className = 'slide poster-slide';
    el.style.setProperty('--accent', accent);


    var chips = (d.highlights && d.highlights.length)
      ? '<ul class="p-chips reveal">' + d.highlights.map(function (h) {
          return '<li>' + esc(h) + '</li>';
        }).join('') + '</ul>'
      : '';

    var photo = d.image ? '<img class="photo" src="' + esc(d.image) + '" alt="">' : '';

    // 标志类图片（协会 Logo / 标识）：用 contain 完整显示，不裁切
    //   在 config.js 里给活动加 imageLogo: true 即可
    var isLogoImg = !!(p.imageLogo || d.imageLogo || d.imageMode === 'logo');
    var logoMode = isLogoImg ? (p.imagePad ? 'pad' : '1') : '';

    var qr = d.qr
      ? '<div class="qr-card"><div class="qr-box"><img src="' + esc(d.qr) + '" alt="QR"></div><p>' + esc(d.qrText || '') + '</p></div>'
      : '';

    el.innerHTML =
      '<div class="poster' + (isEn ? ' lang-en' : '') + '" data-no="' + no + '">' +
        '<div class="poster-grid">' +
          '<div class="poster-main">' +
            '<div class="p-tagrow reveal">' +
              (d.tag ? '<span class="p-tag">' + esc(d.tag) + '</span>' : '') +
              (d.category ? '<span class="p-cat">' + esc(d.category) + '</span>' : '') +
            '</div>' +
            '<h1 class="p-title reveal">' + rich(d.title || '') + '</h1>' +
            '<div class="p-speaker reveal">' +
              '<div>' +
                '<div class="speaker-name">' + esc(speaker) + '</div>' +
                (d.speakerTitle ? '<div class="speaker-role">' + esc(d.speakerTitle) + '</div>' : '') +
              '</div>' +
            '</div>' +
            (d.description ? '<p class="p-desc reveal">' + esc(d.description) + '</p>' : '') +
            chips +
          '</div>' +
          '<div class="poster-side reveal">' +
            '<div class="p-visual"' + (logoMode ? ' data-logo="' + logoMode + '"' : '') + '>' +
              '<div class="grid-deco"></div>' +
              '<div class="arc a1"></div>' +
              '<div class="arc a2"></div>' +
              '<img class="mark" src="' + esc((window.CONFIG && window.CONFIG.settings && window.CONFIG.settings.logoImage) || "SCU Maker's Logo.png") + '" alt="">' +
              '<div class="vtag">SCU MAKER</div>' +
              '<div class="vno">' + no + '</div>' +
              (photo ? photo : '<div class="hint">' + (isEn ? 'EVENT POSTER · replace with your photo' : '活动海报 · 可替换为图片') + '</div>') +
            '</div>' +
            qr +
          '</div>' +
        '</div>' +
        '<div class="p-info reveal">' +
          '<div class="info-item time">' +
            '<span class="info-icon">' + ICON.clock + '</span>' +
            '<div>' +
              '<div class="info-value">' + esc(timeFull) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="info-item place">' +
            '<span class="info-icon">' + ICON.pin + '</span>' +
            '<div><div class="info-value">' + esc(d.place || '') + '</div></div>' +
          '</div>' +
          '<div class="info-item entry">' +
            '<span class="info-icon">' + ICON.ticket + '</span>' +
            '<div><div class="info-value">' + esc(d.entry || '') + '</div></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    return {
      el: el,
      duration: duration,
      title: (isEn ? 'EN · ' : '') + (d.title || ''),
      start: function () {
        document.body.dataset.theme = 'light';
      },
      stop: function () { },
      pause: function () { },
      resume: function () { },
      seek: function () { }
    };
  }

  window.PosterSlide = PosterSlide;
})();
