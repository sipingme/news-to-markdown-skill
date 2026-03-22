/**
 * platforms.js — 平台定制 HTML 预处理
 *
 * 各平台 HTML 结构不同，在通用提取之前先做平台相关的规范化处理。
 * 当前支持：
 *   - toutiao / 163 / 头条系
 *   - (可扩展) weixin, qq, etc.
 */

import { load } from 'cheerio';

/**
 * 根据 URL 判断平台并预处理 HTML
 * @param {string} html - 原始 HTML
 * @param {string} url - 文章 URL
 * @returns {string} 预处理后的 HTML
 */
export function preprocess(html, url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');

    if (isTouTiao(hostname)) {
      return preprocessTouTiao(html);
    }
  } catch (e) {
    // 非 URL 格式，原样返回
  }
  return html;
}

// ── 平台判断 ────────────────────────────────────────────────────────────────

function isTouTiao(hostname) {
  const patterns = [
    'toutiao.com',
    'toutiao.io',
    '163.com',
    '163yun.com',
  ];
  return patterns.some(p => hostname.includes(p));
}

// ── 头条预处理 ───────────────────────────────────────────────────────────────

/**
 * 头条 HTML 规范化：
 * 1. 提取 <article> 区域（过滤页头页脚等噪音）
 * 2. 规范化标题：pgc-h-* class → 标准 h1/h2/h3
 * 3. 规范化图片：div.pgc-img > img → 直接 img[data-src]
 * 4. 规范化表格：div.tableWrapper, div.syl-table-wrap > table → 直接 table
 * 5. 规范化列表：● 符号 → 标准 - 列表项
 * 6. 规范化代码块：3+ 空格行分隔符 → 标准换行
 * 7. 移除嵌套过深的噪音容器
 */
function preprocessTouTiao(html) {
  const $ = load(html);

  // 移除页头、页脚、侧边栏等噪音区域
  const noiseSelectors = [
    'header', 'footer', 'nav', 'aside',
    '.nav', '.navbar', '.header', '.footer',
    '.sidebar', '.side-bar', '#sidebar',
    '.fixed-bar', '.tool-bar',
    '.pgc-off-screen',   // 头条隐藏内容
    'script', 'style', 'noscript', 'iframe',
  ];
  for (const sel of noiseSelectors) {
    try { $(sel).remove(); } catch (_) {}
  }

  // 优先提取 article 区域
  const $article = $('article').first();
  if ($article.length) {
    normalizeTouTiaoHeadings($, $article);
    normalizeTouTiaoImages($, $article);
    normalizeTouTiaoTables($, $article);
    normalizeTouTiaoBullets($, $article);
    normalizeTouTiaoCodeBlocks($, $article);
    return $.html($article);
  }

  // 备用：pgc-html 或 #js_content
  for (const sel of ['.pgc-html', '#js_content', '.article-content']) {
    const $el = $(sel).first();
    if ($el.length) {
      normalizeTouTiaoHeadings($, $el);
      normalizeTouTiaoImages($, $el);
      normalizeTouTiaoTables($, $el);
      normalizeTouTiaoBullets($, $el);
      normalizeTouTiaoCodeBlocks($, $el);
      return $.html($el);
    }
  }

  // 没有特定区域，对整个 body 做规范化
  const $body = $('body');
  normalizeTouTiaoHeadings($, $body);
  normalizeTouTiaoImages($, $body);
  normalizeTouTiaoTables($, $body);
  normalizeTouTiaoBullets($, $body);
  normalizeTouTiaoCodeBlocks($, $body);
  return $body.html() || html;
}

/**
 * 头条图片规范化：
 * 原始结构：<div class="pgc-img"><img data-src="..." src="base64占位"...><p class="pgc-img-caption">...</p></div>
 * 目标结构：<img data-src="..." alt="caption文字">
 *
 * 把 div.pgc-img 替换为其中的 img，alt 取 caption 文字
 */
function normalizeTouTiaoImages($, $root) {
  $root.find('div.pgc-img').each((i, wrapper) => {
    const $wrapper = $(wrapper);
    const $img = $wrapper.find('> img').first();
    const $caption = $wrapper.find('> p.pgc-img-caption').first();

    if ($img.length) {
      // 取 data-src（头条真实图片），不用 src
      let src = $img.attr('data-src') || $img.attr('src') || '';
      // 跳过 base64 占位图
      if (src && !src.includes('data:image') && !src.includes('qpic.cn')) {
        const alt = $caption.length
          ? $caption.text().trim().replace(/"/g, '&#34;')
          : ($img.attr('alt') || '').replace(/"/g, '&#34;');

        // 替换为干净的 img 标签
        const newImg = $(`<img src="${src}" alt="${alt}">`);
        $wrapper.replaceWith(newImg);
        return;
      }
    }
    // 无法处理的 img，移除整个 wrapper
    $wrapper.remove();
  });
}
/**
 * 头条标题规范化：
 * 原始：<h1 class="pgc-h-forward-slash">、<h2 class="pgc-h-border-left"> 等
 * 目标：统一转成标准 <h2>（正文小标题层级）
 *       第一个 <h1 class="pgc-h-edit"> 转成真正的 <h1>
 */
function normalizeTouTiaoHeadings($, $root) {
  let firstTitle = true;
  $root.find('[class*="pgc-h-"]').each((i, el) => {
    const cls = $(el).attr('class') || '';
    let level = 2; // 默认小标题

    if (cls.includes('pgc-h-edit') || cls.includes('article-title')) {
      level = firstTitle ? 1 : 2;
      firstTitle = false;
    } else if (cls.includes('pgc-h-border-left')) {
      level = 2;
    } else if (cls.includes('pgc-h-forward-slash')) {
      level = 2;
    }

    const text = $(el).text().trim();
    if (!text) return;

    const $new = $(`<h${level}>${text}</h${level}>`);
    $(el).replaceWith($new);
  });
}

/**
 * 头条 ● 列表符号规范化：
 * 原始：<p>● 列表内容</p> 或 <span>●</span><span>内容</span>
 * 目标：<ul><li>列表内容</li></ul>
 */
function normalizeTouTiaoBullets($, $root) {
  // 方案1：处理含 ● 的 <p> 标签
  $root.find('p').each((i, el) => {
    const text = $(el).text();
    if (text.includes('\u25cf')) {
      const items = text.split('\u25cf').map(t => t.trim()).filter(t => t);
      if (items.length > 0) {
        const $ul = $('<ul>');
        items.forEach(item => $ul.append($(`<li>${item}</li>`)));
        $(el).replaceWith($ul);
      }
    }
  });

  // 方案2：处理 ● 和内容分离的 span 结构（常见于头条）
  $root.find('span').each((i, el) => {
    const text = $(el).text();
    if (text === '\u25cf' || text === '●') {
      // 找相邻的下一个兄弟 span 作为内容
      const $next = $(el).next('span');
      if ($next.length) {
        const content = $next.text().trim();
        const $li = $(`<li>${content}</li>`);
        const $ul = $(`<ul>`).append($li);
        $(el).remove();
        $next.replaceWith($ul);
      } else {
        $(el).remove();
      }
    }
  });
}

/**
 * 头条代码块规范化：
 * 原始：<pre><code>...    ...    ...</code></pre> （3+ 空格为行分隔）
 * 目标：<pre><code>...\n...\n...</code></pre> （标准换行）
 */
function normalizeTouTiaoCodeBlocks($, $root) {
  $root.find('pre').each((i, pre) => {
    let code = $(pre).find('> code').text() || $(pre).text();
    // 3+ 空格替换为标准换行
    code = code.replace(/ {3,}/g, '\n');
    $(pre).find('> code').text(code);
  });
}

/**
 * 头条表格规范化（增强版）：
 * 处理各种头条表格包装结构
 */
function normalizeTouTiaoTables($, $root) {
  // 两层包装：div.tableWrapper > div.syl-table-wrap > table
  // 先处理内层 syl-table-wrap
  $root.find('div.syl-table-wrap').each((i, inner) => {
    const $inner = $(inner);
    const $table = $inner.find('> table').first();
    if ($table.length) {
      $inner.replaceWith($table);
    } else {
      $inner.remove();
    }
  });
  // 再处理外层 tableWrapper / pgc-table 等
  $root.find('div.tableWrapper, div.pgc-table, div.table-outer').each((i, wrapper) => {
    const $wrapper = $(wrapper);
    const $table = $wrapper.find('> table').first();
    if ($table.length) {
      $wrapper.replaceWith($table);
    } else {
      $wrapper.remove();
    }
  });
}

// ── 导出平台列表（供外部查询） ────────────────────────────────────────────────

export const SUPPORTED_PLATFORMS = [
  {
    id: 'toutiao',
    name: '头条 / TouTiao',
    patterns: ['toutiao.com', 'toutiao.io', '163.com'],
    features: ['article-extract', 'datasrc-images', 'bullet-dot', 'code-spaces', 'heading-hierarchy'],
    note: 'article 区域提取，data-src 图片，● 列表，3+空格代码块，标题层级',
  },
];

export function detectPlatform(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    for (const platform of SUPPORTED_PLATFORMS) {
      if (platform.patterns.some(p => hostname.includes(p))) {
        return platform;
      }
    }
  } catch (_) {}
  return null;
}
