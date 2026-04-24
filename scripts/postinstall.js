#!/usr/bin/env node

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

console.log(`
${BOLD}${GREEN}✅ news-to-markdown Skill v3.3.0${RESET}

${BOLD}📋 功能说明：${RESET}
   输入文章 URL，输出干净的 Markdown 正文。
   - 17 个平台专项优化（头条、微信、知乎、36kr、虎嗅、华尔街见闻、澎湃、InfoQ 等）
   - 三层抓取策略：curl → wget → Playwright 自动回退
   - 双引擎提取：Readability + news-extractor-node 智能取优
   - 图片本地化：下载远程图片，防止 URL 过期

${BOLD}🌐 专项优化平台（17 个）：${RESET}
   ${CYAN}今日头条${RESET}、${CYAN}微信公众号${RESET}、${CYAN}小红书${RESET}、${CYAN}知乎${RESET}、${CYAN}36kr${RESET}
   ${CYAN}虎嗅${RESET}、${CYAN}华尔街见闻${RESET}、${CYAN}澎湃新闻${RESET}、${CYAN}InfoQ${RESET}
   ${CYAN}Bilibili 专栏${RESET}、${CYAN}掘金${RESET}、${CYAN}CSDN${RESET}、${CYAN}博客园${RESET}、${CYAN}简书${RESET}
   ${CYAN}SegmentFault${RESET}、${CYAN}开源中国${RESET}、${CYAN}人人都是产品经理${RESET}

${BOLD}🚀 快速开始：${RESET}

   ${YELLOW}# 基础转换${RESET}
   npx --yes news-to-markdown@^3.3.0 --url "https://www.toutiao.com/article/123"

   ${YELLOW}# 保存到文件${RESET}
   npx --yes news-to-markdown@^3.3.0 --url "https://mp.weixin.qq.com/s/xxx" --output article.md

   ${YELLOW}# 下载图片到本地（推荐，防止图片 URL 过期）${RESET}
   npx --yes news-to-markdown@^3.3.0 \\
     --url "https://www.toutiao.com/article/123" \\
     --download-images --output-dir ./article

   ${YELLOW}# 只要正文${RESET}
   npx --yes news-to-markdown@^3.3.0 --url "https://www.zhihu.com/p/xxx" --no-metadata

${BOLD}⚙️  常用参数：${RESET}
   ${CYAN}--url${RESET}              文章 URL（必填）
   ${CYAN}--output${RESET}           输出文件路径
   ${CYAN}--download-images${RESET}  下载图片到本地
   ${CYAN}--output-dir${RESET}       图片输出目录
   ${CYAN}--no-metadata${RESET}      只要正文，不含标题/作者/时间
   ${CYAN}--selector${RESET}         自定义内容区域 CSS 选择器
   ${CYAN}--noise${RESET}            移除元素选择器（逗号分隔）
   ${CYAN}--verbose${RESET}          详细日志（调试用）

${BOLD}🔗 与 browser-web-search 配合：${RESET}
   bws site toutiao/search "ai agent" --count 3
   npx --yes news-to-markdown@^3.3.0 --url "<url>"

${BOLD}📖 更多文档：${RESET}
   https://github.com/sipingme/news-to-markdown
`);
