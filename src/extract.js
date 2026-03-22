/**
 * extract.js — 三层抓取 + 智能内容提取
 * 
 * 策略顺序：
 *   1. curl — 最快（1-3s），用于静态页面
 *   2. wget — 备选（2-4s），更好的兼容性
 *   3. Playwright — 最慢（5-10s），支持 JavaScript 渲染
 */

import { execSync } from 'node:child_process';
import { extractTextDensity } from './text-density.js';
import { htmlToMarkdown } from './html-to-md.js';
import { preprocess, detectPlatform } from './platforms.js';

/**
 * 从 URL 提取新闻内容
 * @param {string} url - 文章 URL
 * @param {Object} options - 配置选项
 * @returns {Promise<Object>} 提取结果
 */
export async function extractFromUrl(url, options = {}) {
  const { selector, noiseSelectors = [], verbose = false } = options;

  let html = null;
  let method = null;

  // === Layer 1: curl ===
  if (verbose) console.error('[Layer 1/3] 尝试 curl...');
  try {
    const curlCmd = [
      'curl',
      '-s',                        // silent
      '-L',                        // follow redirects
      '-A', '"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"',
      '--max-time', '10',
      '--compressed',
      `"${url}"`
    ].join(' ');

    html = execSync(curlCmd, { encoding: 'utf-8', timeout: 15000 });

    if (html && html.length > 1000) {
      method = 'curl';
      if (verbose) console.error(`[Layer 1/3] ✅ curl 成功 (${html.length} bytes)`);
    } else {
      html = null;
    }
  } catch (e) {
    if (verbose) console.error(`[Layer 1/3] ❌ curl 失败: ${e.message}`);
  }

  // === Layer 2: wget ===
  if (!html) {
    if (verbose) console.error('[Layer 2/3] 尝试 wget...');
    try {
      const wgetCmd = [
        'wget',
        '-q',                        // quiet
        '-O', '-',                   // output to stdout
        '-U', '"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"',
        '--timeout=10',
        '--compression=auto',
        `"${url}"`
      ].join(' ');

      html = execSync(wgetCmd, { encoding: 'utf-8', timeout: 15000 });

      if (html && html.length > 1000) {
        method = 'wget';
        if (verbose) console.error(`[Layer 2/3] ✅ wget 成功 (${html.length} bytes)`);
      } else {
        html = null;
      }
    } catch (e) {
      if (verbose) console.error(`[Layer 2/3] ❌ wget 失败: ${e.message}`);
    }
  }

  // === Layer 3: Playwright ===
  if (!html) {
    if (verbose) console.error('[Layer 3/3] 尝试 Playwright...');
    try {
      html = await fetchWithPlaywright(url, verbose);
      method = 'playwright';
      if (verbose) console.error(`[Layer 3/3] ✅ Playwright 成功 (${html.length} bytes)`);
    } catch (e) {
      if (verbose) console.error(`[Layer 3/3] ❌ Playwright 失败: ${e.message}`);
      throw new Error(`所有抓取方式均失败: curl/wget/Playwright 全部失败`);
    }
  }

  if (!html) {
    throw new Error(`无法获取页面内容`);
  }

  // === 平台预处理 ===
  if (verbose) console.error('[Platform] 平台预处理...');
  const preprocessedHtml = preprocess(html, url);
  if (verbose && preprocessedHtml !== html) {
    console.error('[Platform] 已应用平台特定规范化处理');
  }

  // === 内容提取 ===
  if (verbose) console.error('[Extract] 开始内容提取...');
  const extracted = await extractTextDensity(preprocessedHtml, {
    url,
    selector,
    noiseSelectors,
    verbose,
  });

  // === Markdown 转换 ===
  if (verbose) console.error('[Convert] 转换为 Markdown...');
  let markdown = await htmlToMarkdown(extracted.contentHtml, {
    domain: new URL(url).hostname,
    verbose,
  });

  // === 平台后处理 ===
  const platform = detectPlatform(url);
  if (platform?.id === 'toutiao') {
    markdown = postprocessTouTiaoMarkdown(markdown, verbose);
  }

  return {
    method,
    metadata: extracted.metadata,
    markdown,
    contentHtml: extracted.contentHtml,
    contentLength: extracted.text.length,
    images: extracted.images,
  };
}

/**
 * 头条 Markdown 后处理：
 * 1. ● 符号 → - 列表项
 * 2. 代码块中 3+ 空格 → 换行（头条特有问题）
 */
function postprocessTouTiaoMarkdown(md, verbose = false) {
  let result = md;

  // 1. ● 符号转列表
  // 匹配独立段落中的 ● 分隔符（不在代码块里）
  const codeBlockRe = /```[\s\S]*?```/g;
  const codeBlocks = [];
  let stripped = result.replace(codeBlockRe, (m) => {
    codeBlocks.push(m);
    return `\x00CODE${codeBlocks.length - 1}\x00`;
  });

  stripped = stripped.replace(/^(.+?)(?=\n|$)/gm, (line) => {
    if (line.includes('\u25cf') && !line.startsWith('- ') && !line.startsWith('#')) {
      const items = line.split('\u25cf').map(t => t.trim()).filter(Boolean);
      if (items.length > 1) {
        return items.map(item => `- ${item}`).join('\n');
      }
    }
    return line;
  });

  // 恢复代码块
  stripped = stripped.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)]);

  // 2. 代码块中的 3+ 空格 → 换行
  result = stripped.replace(/```\n([\s\S]*?)```/g, (m, code) => {
    const fixed = code.replace(/ {3,}/g, '\n');
    return '```\n' + fixed + '```';
  });

  if (verbose && result !== md) {
    console.error('[Platform] 已应用头条 Markdown 后处理');
  }

  return result;
}

/**
 * Playwright 动态抓取
 */
async function fetchWithPlaywright(url, verbose) {
  // 动态导入 playwright（可选依赖）
  let playwright;
  try {
    playwright = await import('playwright');
  } catch (e) {
    throw new Error(`Playwright 未安装: ${e.message}`);
  }

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 3000 },
    });

    // 设置 User-Agent
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // 额外等待确保动态内容加载
    await page.waitForTimeout(2000);

    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}
