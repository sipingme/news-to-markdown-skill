---
name: news-to-markdown
description: 一键将新闻文章转换为 Markdown，支持智能内容提取、三层 HTML 抓取策略和头条平台专项优化
version: 1.3.0
author: Ping Si <sipingme@gmail.com>
type: command
requires:
  - node: ">=18.0.0"
  - npm: news-extractor-node@^0.1.0
  - npm: @siping/html-to-markdown-node@^1.0.1
  - npm: playwright@^1.40.0 (optional, 用于动态页面)
tags:
  - news
  - markdown
  - converter
  - extractor
  - web-scraping
  - toutiao
  - 头条
repository: https://github.com/sipingme/news-to-markdown-skill
files:
  - bin/convert-url       # CLI 入口
  - src/extract.js       # 三层抓取策略（含平台后处理）
  - src/text-density.js  # 文本密度算法
  - src/html-to-md.js     # HTML → Markdown 转换
  - src/platforms.js      # 平台定制预处理（头条/163等）
  - scripts/test.js      # 测试脚本
  - package.json
---

# news-to-markdown Skill

## 📋 概述

这是一个专门用于将新闻文章转换为 Markdown 格式的 ClawHub Skill。它结合了智能内容提取和高质量格式转换，能够自动识别新闻正文、过滤噪音内容，并输出格式化的 Markdown 文档。

### 核心特点

1. **智能内容提取**：基于文本密度算法，自动识别新闻正文
2. **三层抓取策略**：curl → wget → Playwright，确保高成功率
3. **自动元数据提取**：标题、作者、发布时间
4. **噪音过滤**：自动去除广告、评论等无关内容
5. **高质量输出**：保留文章结构，正确处理链接和图片

## 🎯 使用场景

### 场景 1：快速保存新闻文章

**用户意图**：
- "帮我保存这篇新闻"
- "把这个链接的文章转成 Markdown"
- "下载这篇文章"

**AI 调用**：
```bash
convert-url --url "https://example.com/news/article" \
            --output "article.md"
```

**输出**：
- 包含元数据的完整 Markdown 文件
- 自动过滤广告和评论
- 收集所有图片链接

### 场景 2：批量采集新闻

**用户意图**：
- "把这些新闻都保存下来"
- "批量下载这个列表的文章"

**AI 调用**：
```bash
# 循环处理多个 URL
for url in "${urls[@]}"; do
  convert-url --url "$url" --output "articles/$(basename $url).md"
done
```

### 场景 3：处理动态网站

**用户意图**：
- "这个网站需要 JavaScript 才能显示内容"
- "页面是动态加载的"

**AI 行为**：
- 自动检测并使用 Playwright
- 等待页面完全加载
- 提取渲染后的内容

### 场景 4：自定义提取

**用户意图**：
- "只要正文，不要其他的"
- "去掉侧边栏和评论"

**AI 调用**：
```bash
convert-url --url "https://example.com/news" \
            --noise ".sidebar,.comments,.ads" \
            --no-metadata
```

## 🔧 命令详解

### convert-url

从 URL 提取新闻并转换为 Markdown。

#### 参数

| 参数 | 类型 | 必需 | 说明 | 示例 |
|------|------|------|------|------|
| `--url` | string | ✅ | 新闻文章的 URL | `https://example.com/news` |
| `--output` | string | ❌ | 输出文件路径 | `article.md` |
| `--selector` | string | ❌ | CSS 选择器，指定提取区域 | `article.content` |
| `--noise` | string | ❌ | 要移除的元素（逗号分隔） | `.ad,.sidebar,.comments` |
| `--no-metadata` | flag | ❌ | 不包含元数据（标题、作者、时间） | - |

#### 返回值

**成功时**：
```json
{
  "success": true,
  "metadata": {
    "title": "文章标题",
    "author": "作者名",
    "publishTime": "2026-03-22 10:30:00",
    "imageCount": 3,
    "contentLength": 1234
  }
}
```

**失败时**：
```json
{
  "success": false,
  "error": "错误信息"
}
```

#### 输出格式

**标准格式**（包含元数据）：
```markdown
# 文章标题

**作者**: 张三  
**发布时间**: 2026-03-22 10:30:00  
**来源**: https://example.com/news/article

---

正文内容...

## 图片列表

- ![](image1.jpg)
- ![](image2.jpg)
```

**简洁格式**（`--no-metadata`）：
```markdown
正文内容...
```

## 🚀 工作流程

### 1. HTML 抓取（三层策略）

```
尝试 curl (最快，1-3秒)
  ↓ 失败
尝试 wget (备选)
  ↓ 失败
使用 Playwright (支持 JS，5-10秒)
  ↓
成功获取 HTML
```

**特点**：
- ✅ 自动选择最快的方式
- ✅ 失败时自动降级
- ✅ 显示当前使用的方法
- ✅ 整体成功率 95%+

### 2. 内容提取

使用 `news-extractor-node` 的文本密度算法：

```javascript
const extractor = new NewsExtractor();
const news = extractor.extract(html, {
  url: url,
  noiseSelectors: ['.ad', '.comment', 'aside']
});
```

**提取内容**：
- 标题（多种策略）
- 作者（正则匹配 + 选择器）
- 发布时间（多种日期格式）
- 正文（文本密度算法）
- 图片（自动收集）

### 3. Markdown 转换

使用 `@siping/html-to-markdown-node`：

```javascript
const markdown = convertString(news.contentHtml, {
  domain: url
});
```

**转换特点**：
- 保留标题层级
- 正确处理列表
- 转换代码块
- 解析相对 URL
- 智能转义

## 📊 性能指标

| 指标 | curl | wget | Playwright |
|------|------|------|------------|
| 速度 | 1-3秒 | 2-4秒 | 5-10秒 |
| 成功率 | 70% | 75% | 95% |
| JS 支持 | ❌ | ❌ | ✅ |
| 资源占用 | 极低 | 低 | 中 |

**整体性能**：
- 平均响应时间：2-5 秒
- 整体成功率：95%+
- 支持网站类型：静态 + SPA

## ⚠️ 注意事项

### 1. 网络要求

- 需要能够访问目标 URL
- 某些网站可能有反爬虫机制
- 建议使用稳定的网络连接

### 2. Playwright 安装

首次使用 Playwright 需要安装浏览器：

```bash
npx playwright install chromium
```

### 3. 网站兼容性

**高兼容性**：
- 主流新闻网站（新浪、网易、腾讯等）
- 技术博客（CSDN、掘金等）
- 官方新闻站

**可能需要调整**：
- 特殊布局的网站（使用 `--selector`）
- 需要登录的网站
- 有严格反爬虫的网站

### 4. 内容准确性

- 文本密度算法对大多数新闻网站准确率高
- 对于特殊布局，可能需要自定义选择器
- 建议检查输出结果

## 🎨 AI 使用指南

### 识别新闻采集需求

**关键词**：
- "保存新闻"、"下载文章"
- "转换为 Markdown"
- "采集内容"、"提取正文"

**URL 特征**：
- 包含 `/news/`、`/article/`
- 新闻网站域名
- 博客文章链接

### 参数选择建议

**默认使用**：
```bash
convert-url --url "$URL" --output "article.md"
```

**用户要求"只要正文"**：
```bash
convert-url --url "$URL" --no-metadata
```

**用户提到"去掉广告/评论"**：
```bash
convert-url --url "$URL" --noise ".ad,.comment,.sidebar"
```

**用户指定"只要某个部分"**：
```bash
convert-url --url "$URL" --selector "article.main-content"
```

### 错误处理

**抓取失败**：
```
建议：
1. 检查 URL 是否正确
2. 尝试在浏览器中打开
3. 检查网络连接
4. 确认 Playwright 已安装
```

**提取失败**：
```
建议：
1. 使用 --selector 指定内容区域
2. 调整 --noise 过滤规则
3. 检查网站是否需要登录
```

## 🔍 常见问题

### Q1: 为什么有些网站抓取失败？

**A**: 可能的原因：
1. 网站需要 JavaScript 渲染（会自动使用 Playwright）
2. 网站有反爬虫机制
3. 需要登录才能访问
4. 网络连接问题

**解决方案**：
- 检查 Playwright 是否已安装
- 尝试在浏览器中打开 URL
- 使用 `--selector` 指定内容区域

### Q2: 提取的内容不准确怎么办？

**A**: 使用自定义选择器：
```bash
convert-url --url "$URL" --selector "article.main-content"
```

### Q3: 如何去除特定元素？

**A**: 使用 `--noise` 参数：
```bash
convert-url --url "$URL" --noise ".ad,.sidebar,.comments"
```

### Q4: 支持哪些网站？

**A**: 
- ✅ 大多数新闻网站（静态 HTML）
- ✅ 技术博客
- ✅ SPA 网站（通过 Playwright）
- ⚠️ 需要登录的网站（不支持）

## 📚 示例对话

### 示例 1: 简单保存

**用户**: "帮我保存这篇新闻 https://example.com/news/ai-breakthrough"

**AI**: 
```
我来帮你保存这篇新闻。

[调用 convert-url --url "https://example.com/news/ai-breakthrough" --output "ai-breakthrough.md"]

✅ 已成功保存到 ai-breakthrough.md

文章信息：
- 标题：AI 技术取得重大突破
- 作者：张三
- 发布时间：2026-03-22
- 图片数量：3 张
```

### 示例 2: 批量处理

**用户**: "把这些新闻都保存下来：[URL1, URL2, URL3]"

**AI**:
```
我来批量保存这些新闻。

正在处理 URL1...
✅ 已保存到 article-1.md

正在处理 URL2...
✅ 已保存到 article-2.md

正在处理 URL3...
✅ 已保存到 article-3.md

全部完成！共保存 3 篇文章。
```

### 示例 3: 自定义提取

**用户**: "只要正文，不要标题和作者信息"

**AI**:
```
好的，我只提取正文内容。

[调用 convert-url --url "$URL" --no-metadata]

✅ 已保存纯正文内容。
```

## 🛠️ 维护说明

### 依赖更新

定期更新依赖以获得最新功能和修复：

```bash
npm update news-extractor-node
npm update @siping/html-to-markdown-node
npm update playwright
```

### 测试

建议定期测试常用网站：

```bash
# 测试主流新闻网站
bash scripts/convert.sh --url "https://news.sina.com.cn/..."
bash scripts/convert.sh --url "https://news.163.com/..."
bash scripts/convert.sh --url "https://tech.qq.com/..."
```

### 日志

脚本会输出详细的执行日志：
- 使用的抓取方式
- 提取的元数据
- 转换结果

## 📞 支持

- GitHub Issues: https://github.com/sipingme/news-to-markdown-skill/issues
- Email: sipingme@gmail.com

---

**版本**: 1.3.0  
**最后更新**: 2026-03-22

## 🐛 v1.3.0 更新 (2026-03-22)

- ✅ 头条标题层级规范化：pgc-h-* class → 标准 h1/h2/h3
- ✅ 头条 ● 列表符号自动转 Markdown 列表
- ✅ 头条代码块 3+ 空格行分隔符 → 标准换行
- ✅ 头条表格包装器增强：支持 tableWrapper / pgc-table / table-outer
