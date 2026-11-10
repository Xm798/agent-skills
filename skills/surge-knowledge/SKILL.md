---
name: surge-knowledge
description: Surge 配置与脚本的文档查询。当问题是"怎么写"而不是"现在怎样"时使用：profile 语法（[General]/[Proxy]/[Rule] 等段落）、规则与策略组写法、代理协议参数、MITM、DNS、Rewrite、模块编写、脚本 API（$httpClient、$persistentStore 等）、WireGuard、Surge Ponte、iOS/tvOS 上的配置。操作或诊断正在运行的 Surge（状态、日志、路由判断、连通性、临时规则）交给 surge skill。
---

# Surge 文档查询

以 https://nssurge.com/llms.txt 为准回答；它没覆盖的，再查官方文档和知识库，仍找不到就如实说明并建议去社区论坛问。

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

- 示例按官方格式写完整片段，标出 Mac / iOS / tvOS 的差异。
- 本机有 Surge 时，写好的 profile 用 `surge-cli --check <path>` 校验（见 surge skill）。
