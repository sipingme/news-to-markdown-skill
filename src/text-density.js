/**
 * text-density.js — 基于 news-extractor-node 的新闻内容提取
 * 
 * 使用 news-extractor-node 实现：
 *   - 文本密度算法（ContentExtractor）
 *   - 标题提取（TitleExtractor）
 *   - 作者提取（AuthorExtractor）
 *   - 时间提取（TimeExtractor）
 *   - 图片收集（自动处理相对 URL）
 */

let NewsExtractor;
try {
  ({ NewsExtractor } = await import('news-extractor-node'));
} catch (e) {
  // news-extractor-node 未安装，降级提示
  NewsExtractor = null;
}

const DEFAULT_NOISE = [
  'script', 'style', 'noscript', 'iframe',
  'nav', 'header', 'footer', 'aside',
  '.ad', '.ads', '.advertisement', '.advert',
  '.sidebar', '.side-bar', '#sidebar',
  '.comments', '.comment', '#comments', '.comment-list',
  '.related', '.related-articles', '.recommend',
  '.share', '.share-box', '.social-share',
  '.tags', '.tag-list',
  '.author-box', '.author-info', '.author-bio',
  '.popup', '.modal', '.overlay',
  '.breadcrumb', '.breadcrumbs',
  '.pagination', '.pager',
  '.news-ad', '.article-ad',
];

export async function extractTextDensity(html, options = {}) {
  const { url, selector, noiseSelectors = [], verbose = false } = options;

  if (!NewsExtractor) {
    throw new Error(
      'news-extractor-node 未安装。请运行: npm install news-extractor-node'
    );
  }

  const extractor = new NewsExtractor();
  const allNoise = [...DEFAULT_NOISE, ...noiseSelectors];

  const result = extractor.extract(html, {
    url,
    noiseSelectors: allNoise,
    contentXPath: selector || undefined,
  });

  // 标准化返回格式
  return {
    metadata: {
      title: result.title || '',
      author: result.author || '',
      publishTime: result.publishTime || '',
      source: url ? new URL(url).hostname : '',
    },
    contentHtml: result.contentHtml || '',
    text: result.content || '',
    images: (result.images || []).map(img => ({
      src: img.src || img,
      alt: (img.alt || '').replace(/"/g, '&#34;'),
    })),
  };
}
