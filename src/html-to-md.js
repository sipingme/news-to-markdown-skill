/**
 * html-to-md.js — HTML 转 Markdown
 * 
 * 策略：优先使用 @siping/html-to-markdown-node，
 * 如果不可用则用简单的手写转换逻辑
 */

import { load } from 'cheerio';
import { convertString as html2mdConvert } from '@siping/html-to-markdown-node';

export async function htmlToMarkdown(html, options = {}) {
  const { domain, verbose = false } = options;

  // 检测平台：头条、微信等有特殊 HTML 结构，跳过 html2mdConvert
  const isSpecialPlatform = domain && (
    domain.includes('toutiao') ||
    domain.includes('163.com') ||
    domain.includes('weixin') ||
    domain.includes('qq.com')
  );

  // 优先用手写转换逻辑（支持头条平台特性）
  if (verbose) console.error('[Convert] 使用手写转换逻辑');
  const simpleMd = htmlToMarkdownSimple(html);
  if (simpleMd && simpleMd.length > 100) {
    if (verbose) console.error('[Convert] 手写逻辑成功 (' + simpleMd.length + ' chars)');
    return simpleMd;
  }

  // 备用：html-to-markdown-node（普通网站）
  try {
    const md = html2mdConvert(html, { domain });
    if (md && md.length > 50) {
      if (verbose) console.error('[Convert] html-to-markdown-node 成功');
      return md;
    }
  } catch (e) {
    if (verbose) console.error('[Convert] html-to-markdown-node 失败: ' + e.message);
  }

  return simpleMd || '';
}

/**
 * 表格转 Markdown
 * 处理：嵌套 table / thead / tbody / colspan / rowspan / 富文本单元格
 */
function convertTable($, tableEl) {
  const $table = $(tableEl);

  // 收集所有行
  const allRows = [];

  // thead 中的 tr（表头行）
  const $thead = $table.children('thead');
  if ($thead.length) {
    $thead.children('tr').each((ri, tr) => {
      const cells = extractRowCells($, tr);
      if (cells.length > 0) allRows.push({ cells, isHeader: true });
    });
  }

  // tbody / 直接子 tr（跳过已在 thead 里的）
  const $tbody = $table.children('tbody');
  const $target = $tbody.length ? $tbody.children('tr') : $table.children('tr');

  $target.each((ri, tr) => {
    const cells = extractRowCells($, tr);
    if (cells.length > 0) allRows.push({ cells, isHeader: false });
  });

  if (allRows.length === 0) return '';

  // 确定表头：有 thead 用 thead 第一行；否则用第一行
  const theadRows = allRows.filter(r => r.isHeader);
  const headerRow = theadRows.length > 0 ? theadRows[0].cells : allRows[0].cells;
  const bodyRows = theadRows.length > 0
    ? allRows.filter(r => !r.isHeader)
    : allRows.slice(1);

  // 确定列数（考虑 colspan）
  const maxCols = Math.max(
    headerRow.reduce((sum, c) => sum + (c.colspan || 1), 0),
    ...bodyRows.map(r => r.cells.reduce((sum, c) => sum + (c.colspan || 1), 0))
  );

  function expandRow(row) {
    const cells = [];
    for (const cell of row.cells) {
      const text = cell.text;
      const n = cell.colspan || 1;
      for (let i = 0; i < n; i++) cells.push(text);
    }
    while (cells.length < maxCols) cells.push('');
    return cells.slice(0, maxCols);
  }

  const headerCells = expandRow({ cells: headerRow });
  const lines = [];
  lines.push('| ' + headerCells.join(' | ') + ' |');
  lines.push('| ' + headerCells.map(() => '---').join(' | ') + ' |');
  for (const row of bodyRows) {
    lines.push('| ' + expandRow(row).join(' | ') + ' |');
  }

  return lines.join('\n') + '\n\n';
}

/**
 * 提取一行中的所有单元格（含 colspan 处理）
 */
function extractRowCells($, trEl) {
  const cells = [];
  $(trEl).find('th, td').each((ci, cell) => {
    const $cell = $(cell);
    const colspan = parseInt($cell.attr('colspan') || '1', 10);
    const text = extractCellText($, cell);
    cells.push({ text, colspan });
  });
  return cells;
}

/**
 * 提取单元格文本（保留链接、图片等为 Markdown 格式）
 */
function extractCellText($, cellEl) {
  const $cell = $(cellEl);
  let text = '';

  $cell.contents().each((i, node) => {
    if (node.type === 'text') {
      const t = node.data.trim();
      if (t) text += t + ' ';
    } else if (node.name === 'a') {
      const href = $(node).attr('href') || '';
      const linkText = $(node).text().trim();
      if (href && linkText) {
        text += `[${linkText}](${href})`;
      } else if (linkText) {
        text += linkText;
      }
    } else if (node.name === 'img') {
      const src = $(node).attr('src') || $(node).attr('data-src') || '';
      const alt = $(node).attr('alt') || '';
      if (src && !src.startsWith('data:')) {
        text += `![${alt}](${src})`;
      }
    } else if (node.name === 'br') {
      text += '\n';
    } else if (['strong', 'b', 'em', 'i', 'code', 'span'].includes(node.name)) {
      text += extractCellText($, node);
    }
  });

  // 转义管道符
  text = text.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
  return text;
}

function htmlToMarkdownSimple(html) {
  const $ = load(html);

  // 预处理
  $('script, style, noscript, iframe, svg, button').remove();

  const parts = [];

  function getInner(el) {
    return $(el).html() || '';
  }

  function escapeMd(str) {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\|/g, '\\|')
      .replace(/>/g, '\\>')
      .replace(/#/g, '\\#');
  }

  function processNode(el) {
    const tag = el.name;
    const cls = $(el).attr('class') || '';
    const id = $(el).attr('id') || '';

    if (tag === 'h1') {
      const text = $(el).text().trim();
      if (text) parts.push(`# ${text}\n\n`);
    } else if (tag === 'h2') {
      const text = $(el).text().trim();
      if (text) parts.push(`## ${text}\n\n`);
    } else if (tag === 'h3') {
      const text = $(el).text().trim();
      if (text) parts.push(`### ${text}\n\n`);
    } else if (tag === 'h4') {
      const text = $(el).text().trim();
      if (text) parts.push(`#### ${text}\n\n`);
    } else if (tag === 'h5' || tag === 'h6') {
      const text = $(el).text().trim();
      if (text) parts.push(`##### ${text}\n\n`);
    } else if (tag === 'p') {
      const inner = getInner(el);
      const text = $(el).text().trim();
      if (!text) return;
      // 如果 inner 包含 <br>，需要保留换行
      const textWithBreaks = inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
      const cleanText = textWithBreaks.trim();
      if (cleanText) parts.push(cleanText + '\n\n');
    } else if (tag === 'ul') {
      $(el).find('> li').each((i, li) => {
        const text = $(li).text().trim();
        if (text) parts.push(`- ${text}\n`);
      });
      parts.push('\n');
    } else if (tag === 'ol') {
      $(el).find('> li').each((i, li) => {
        const text = $(li).text().trim();
        if (text) parts.push(`${i + 1}. ${text}\n`);
      });
      parts.push('\n');
    } else if (tag === 'blockquote') {
      const text = $(el).text().trim();
      if (text) {
        text.split('\n').forEach(line => {
          parts.push(`> ${line}\n`);
        });
        parts.push('\n');
      }
    } else if (tag === 'pre' || tag === 'code') {
      const code = tag === 'pre' ? $(el).text() : $(el).text();
      if (code.trim()) {
        parts.push('```\n' + code + '\n```\n\n');
      }
    } else if (tag === 'table') {
      // 表格转换：处理嵌套 table / thead / tbody / colspan / rowspan
      const mdTable = convertTable($, el);
      if (mdTable) {
        parts.push(mdTable);
      }
    } else if (tag === 'img') {
      const src = $(el).attr('src') || $(el).attr('data-src') || '';
      const alt = $(el).attr('alt') || '';
      if (src && !src.startsWith('data:')) {
        parts.push(`![${alt}](${src})\n\n`);
      }
    } else if (tag === 'a') {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (href && text) {
        parts.push(`[${text}](${href})`);
      } else if (text) {
        parts.push(text);
      }
    } else if (tag === 'br') {
      parts.push('\n');
    } else if (tag === 'hr') {
      parts.push('---\n\n');
    } else if (tag === 'strong' || tag === 'b') {
      const text = $(el).text().trim();
      if (text) parts.push(`**${text}**`);
    } else if (tag === 'em' || tag === 'i') {
      const text = $(el).text().trim();
      if (text) parts.push(`*${text}*`);
    } else {
      // 递归处理子节点
      $(el).contents().each((i, child) => {
        if (child.type === 'tag') {
          processNode(child);
        } else if (child.type === 'text') {
          const text = child.data.trim();
          if (text) parts.push(text);
        }
      });
    }
  }

  $('body, article, main, div').each((i, el) => {
    const text = $(el).text().trim();
    if (text.length > 100 && (el.name === 'article' || el.name === 'main')) {
      $(el).children().each((ci, child) => {
        if (child.type === 'tag') processNode(child);
      });
    }
  });

  // 如果 parts 为空，尝试 body 直接转换
  if (parts.length === 0 || parts.every(p => !p.trim())) {
    $('body').children().each((i, child) => {
      if (child.type === 'tag') processNode(child);
    });
  }

  let md = parts.join('');

  // 清理多余空行（超过2个连续空行）
  md = md.replace(/\n{3,}/g, '\n\n');
  // 清理行首行尾空格
  md = md.split('\n').map(l => l.trimEnd()).join('\n');
  // trim
  md = md.trim();

  return md;
}
