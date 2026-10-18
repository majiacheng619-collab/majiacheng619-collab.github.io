# 我的匿名访客统计

我通过[访客记录面板](https://majiacheng619-collab.github.io/visitors/)查看每日与累计独立访客。我的面板页面公开，数据接口需要站主访问密钥；我不把密钥写入网站源码、日志或浏览器持久存储。

## 我的当前部署

我用 GitHub Pages 发布静态网站，用 Cloudflare Pages Functions 与 D1 处理匿名统计。我的公开接口配置保存在 `portfolio-source/analytics-config.json`，接口项目为 `mjc-visitor-records-619`，数据库为 `mjc-visitors`。我以面板的实际接口响应核对数据，不以工作流成功代替真实采集验证。

我用 `deploy.py` 维护当前部署，复用同名数据库并应用幂等迁移。我保留当前服务端源码、迁移和测试，删除已经停用的 Workers 域名配置与重复初始化脚本。我的运行服务不依赖部署 API Token 持续有效；我的访问密钥只保存在受保护的配置中。

## 我的重新部署流程

1. 我登录 Cloudflare，取得账号 ID，并创建仅限该账号、具备 Pages Edit 与 D1 Edit 权限的 API Token。我不将密钥写入聊天、文件或提交记录。
2. 我在仓库的 Actions 加密配置中维护以下三个值：

   | 名称 | 我的配置内容 |
   | --- | --- |
   | `CLOUDFLARE_ACCOUNT_ID` | 我的 Cloudflare 账号 ID |
   | `CLOUDFLARE_API_TOKEN` | 我的账号级部署 API Token |
   | `VISITOR_ADMIN_TOKEN` | 我生成并妥善保存的随机面板密钥，至少 24 字符 |

3. 我手动运行 **Connect visitor analytics**。我先运行测试、创建或复用数据库、应用迁移并部署 Functions；私密读取检查通过后，才写入公开接口地址并发布网站。我在重复部署时保留既有数据库与匿名访客身份。
4. 我打开 `/visitors/` 并输入面板密钥，可选择排除自己在当前浏览器的后续访问。我更换密钥时，同时更新 Cloudflare 与对应 Actions 加密配置，不回减既有匿名记录。

## 我的统计口径

- 我在全站复用浏览器随机 UUID，按北京时间划分日期。我用 `(day, visitor_hash)` 去重每日访问，用 `visitor_hash` 去重累计访问，避免相同标识因刷新、切页、重开、多标签或重试重复计数。
- 我将首次出现的浏览器标识记为新访客，不将每日 UV 相加作为累计独立访客数。我不将浏览器数量宣称为独立自然人数。
- 我优先复用 Cookie 与 localStorage 中的标识，并用 Web Locks 协调首次生成。我无法跨设备、跨浏览器、无痕访问或清除存储后识别同一自然人。
- 我尊重 GPC、DNT 与主动退出偏好，跳过存储被阻止、自动化标记、iframe、站主面板和隐私页面的采集。我让采集失败不影响浏览网站；页面可见并停留跨越午夜时，可计入下一天。
- 我只在统计数据库中保留匿名哈希与日期，不保存浏览路径、来源、原始 UUID、IP、设备指纹或身份资料。我在[统计与隐私说明](https://majiacheng619-collab.github.io/privacy/)中说明网络服务商处理连接请求的边界。
- 我通过 Origin 校验和请求长度限制降低误用，但不将其视为身份认证或完全抗刷措施。我不使用 IP 合并访客，避免把同一网络中的不同浏览器误算为一位。
- 我从统计服务接通后开始记录，无法恢复接通前的访问。我不公开逐访客日志，也不开放未鉴权的统计读取。

## 我的验证方式

我使用 Node 24 运行 `node --test visitor-service/*.test.mjs`。我用 SQLite 执行实际迁移与 SQL，覆盖并发幂等、跨日语义、上海零点、日期补零、鉴权、参数校验、CORS 与数据库失败；我的浏览器脚本测试覆盖刷新、切页、后续日期、隐私退出、禁用存储和失败重试。

我在部署后继续实测：同一浏览器反复刷新时当日 UV 不变；另一浏览器首次到访时 UV 增加；原浏览器次日回访时累计访客不增加；无有效面板密钥读取 `/stats` 时被拒绝。我导出的 CSV 对应面板当前选择的日期范围。

我参考 Cloudflare 的 [Pages Functions 文档](https://developers.cloudflare.com/pages/functions/advanced-mode/)与 [D1 文档](https://developers.cloudflare.com/d1/worker-api/d1-database/)维护服务。
