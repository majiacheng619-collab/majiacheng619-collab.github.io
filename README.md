# 马嘉程

我是马嘉程，2027 届本科生，求职方向覆盖与已有经历相关的运营、市场、商务、用户服务和产品与项目执行。我在这里以背景、目标、行动与结果展开自己的作品与实践。

- [个人网站](https://majiacheng619-collab.github.io/)：我整理了项目、经历与联系方式。
- [个人简历](https://majiacheng619-collab.github.io/resume-beb4a3432690.pdf)：我的教育与实践经历。
- [我的能力与作品 · 25 秒影片](https://majiacheng619-collab.github.io/#introduction)：前半段展示我的电商增长与产品交付，后半段呈现《冰之圣殿》的鲸跃和冰拱。
- [冰之圣殿 · 实时 3D 场景](https://majiacheng619-collab.github.io/ice/)：我用 Three.js 与 GLSL 构建的极地航行场景。
- [萌芽保卫队](https://majiacheng619-collab.github.io/game/)：我独立策划、通过 AI 辅助开发的网页塔防游戏，包含四个世界、二十关。

## 构建与校验

我使用 Python 3、Node.js 24、Java 21 和 FFmpeg 在本地构建与校验。

```sh
python3 -m pip install -r requirements-build.txt
npm ci --ignore-scripts
npm run check
```

`npm run check` 生成 `_site`，校验本地链接、资源指纹与 HTML。`deploy.zip` 是构建所需的媒体和游戏种子。日常校验保留它原样。
