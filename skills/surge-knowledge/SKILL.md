---
name: surge-knowledge
description: Surge 配置与脚本的文档查询。当问题是"怎么写"而不是"现在怎样"时使用：profile 语法（[General]/[Proxy]/[Rule] 等段落）、规则与策略组写法、代理协议参数、MITM、DNS、Rewrite、模块编写、脚本 API（$httpClient、$persistentStore 等）、iOS/tvOS 上的配置。操作或诊断正在运行的 Surge（状态、日志、路由判断、连通性、临时规则）交给 surge skill。
---

# Surge 文档查询

先取 https://nssurge.com/llms.txt，以它为准回答；它没覆盖的，再查 https://manual.nssurge.com/ 和 https://kb.nssurge.com/，仍找不到就如实说明。

- 示例按官方格式写完整片段，标出 Mac / iOS / tvOS 的差异。
- 本机有 Surge 时，写好的 profile 用 `surge-cli --check <path>` 校验（见 surge skill）。
