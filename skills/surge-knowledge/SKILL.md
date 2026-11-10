---
name: surge-knowledge
description: Surge 网络调试代理工具的官方知识库。当用户询问 Surge 配置、规则编写、脚本开发、MITM 设置、代理配置、DNS 设置、模块使用等问题时使用此 skill。Surge 是一款专为开发者设计的 Web 开发和代理工具，支持 macOS、iOS 和 tvOS 平台。
---

# Surge Knowledge Base

Surge 是一款专业的网络调试代理工具，具有流量接管、请求处理、代理转发、数据拦截等核心能力。

## 使用方法

当用户询问 Surge 相关问题时，首先通过 web_fetch 获取官方知识库文档：

```
web_fetch("https://nssurge.com/llms.txt")
```

该文档包含 Surge 的完整配置指南和 API 文档，是回答 Surge 问题的权威参考。

## Surge 核心功能概述

1. **流量接管 (Takeover)**: 代理服务和虚拟网卡接管
2. **请求处理 (Processing)**: URL 重定向、本地文件映射、JavaScript 修改
3. **代理转发 (Forwarding)**: 全局或规则系统决定出站策略
4. **数据拦截 (Intercept)**: 截获并保存网络数据，支持 HTTPS 解密 (MITM)

## 常见问题类型

回答以下类型问题时，务必先获取 llms.txt：

- 配置文件语法 (`[General]`, `[Proxy]`, `[Rule]` 等段落)
- 规则编写 (DOMAIN, DOMAIN-SUFFIX, IP-CIDR, GEOIP 等)
- 代理协议配置 (HTTP, HTTPS, SOCKS5, Shadowsocks, Trojan, VMess 等)
- 脚本开发 (`$httpClient`, `$notification`, `$persistentStore` 等 API)
- 模块 (Module) 编写和使用
- MITM 和证书配置
- DNS 和 DoH/DoT 设置
- 策略组 (Proxy Group) 配置
- URL Rewrite 和 Header Rewrite
- WireGuard 配置
- Surge Ponte 远程访问

## 官方资源

- 官方文档: https://manual.nssurge.com/
- 知识库: https://kb.nssurge.com/
- LLM 文档: https://nssurge.com/llms.txt
- 社区论坛: https://community.nssurge.com/

## 回答准则

1. 始终以 llms.txt 文档为权威参考
2. 配置示例应遵循官方推荐格式
3. 区分 Mac/iOS/tvOS 平台差异
4. 对于复杂配置，提供完整示例代码
5. 若文档未涵盖的问题，明确告知用户并建议查阅官方社区
