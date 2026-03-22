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
 * 2. 规范化图片：div.pgc-img > img → 直接 img[data-src]
 * 3. 规范化表格：div.tableWrapper > table → 直接 table
 * 4. 移除嵌套过深的噪音容器
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
    // 在 article 内部做图片和表格规范化
    normalizeTouTiaoImages($, $article);
    normalizeTouTiaoTables($, $article);
    return $.html($article);
  }

  // 备用：pgc-html 或 #js_content
  for (const sel of ['.pgc-html', '#js_content', '.article-content']) {
    const $el = $(sel).first();
    if ($el.length) {
      normalizeTouTiaoImages($, $el);
      normalizeTouTiaoTables($, $el);
      return $.html($el);
    }
  }

  // 没有特定区域，对整个 body 做规范化
  normalizeTouTiaoImages($, $('body'));
  normalizeTouTiaoTables($, $('body'));
  return $('body').html() || html;
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
 * 头条表格规范化：
 * 原始结构：<div class="tableWrapper"><table>...</table></div>
 * 目标结构：直接 <table>...</table>
 * 同时处理 thead/tbody 结构
 */
function normalizeTouTiaoTables($, $root) {
  $root.find('div.tableWrapper').each((i, wrapper) => {
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
    features: ['article-extract', 'datasrc-images', 'bullet-dot', 'code-spaces'],
    note: 'article 区域提取，data-src 图片，● 列表，3+空格代码块',
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
