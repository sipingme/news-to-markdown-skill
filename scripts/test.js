#!/usr/bin/env node
/**
 * test.js — 新闻转 Markdown 测试脚本
 * 
 * 测试 news-to-markdown 核心库的转换功能
 */

const { NewsToMarkdownConverter } = require('news-to-markdown');

const TEST_URLS = [
  {
    name: '新浪新闻',
    url: 'https://news.sina.com.cn/',
    note: '静态页面，测试 curl 策略',
  },
  {
    name: '网易新闻',
    url: 'https://news.163.com/',
    note: '静态页面，测试 wget 降级',
  },
  {
    name: '腾讯新闻',
    url: 'https://news.qq.com/',
    note: '静态页面',
  },
];

async function test() {
  console.log('🧪 news-to-markdown 测试\n');

  const converter = new NewsToMarkdownConverter();

  for (const testCase of TEST_URLS) {
    console.log(`📰 ${testCase.name}`);
    console.log(`   URL: ${testCase.url}`);
    console.log(`   说明: ${testCase.note}`);

    const startTime = Date.now();

    try {
      const result = await converter.convert({
        url: testCase.url,
        verbose: false,
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`   ✅ 成功 (${elapsed}s)`);
      console.log(`   抓取方式: ${result.metadata.fetchMethod}`);
      console.log(`   标题: ${result.metadata.title || '(无)'}`);
      console.log(`   长度: ${result.metadata.contentLength} 字符`);
      console.log(`   图片: ${result.metadata.imageCount} 张`);
    } catch (e) {
      console.log(`   ❌ 失败: ${e.message}`);
    }

    console.log('');
  }
}

test().catch(console.error);
