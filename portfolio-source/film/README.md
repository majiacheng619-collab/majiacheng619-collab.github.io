# 冰之圣殿 · Cathedral of Ice

我用同一个 25 秒时间轴做成作品影片和浏览器实时场景。首页使用 H.264 和字幕，实时场景在 `/ice/` 点击播放后加载，可拖动预览不同时间。

| 时段 | 镜头 |
| --- | --- |
| 0–4 秒 | 广角扫过极光与冰谷，科考船从画面下方驶入 |
| 4–10 秒 | 靠近船身和驾驶室，跟随航迹 |
| 10–17 秒 | 穿进峡谷，鲸鱼跃出并落回海面 |
| 17–25 秒 | 镜头升高拉远，船继续驶向冰拱 |

## 逐帧导出

我使用 Node.js 22+、Playwright Chromium 和 FFmpeg 固定采样。完成依赖安装后，在仓库根目录执行以下命令。

```sh
export FILM_TOOLS="$(mktemp -d)"
npm install --prefix "$FILM_TOOLS" playwright@1.62.1
"$FILM_TOOLS/node_modules/.bin/playwright" install chromium
export NODE_PATH="$FILM_TOOLS/node_modules"
node portfolio-source/film/export.mjs --output portfolio-source/film/.build --workers 2
python3 portfolio-source/prepare_release.py --preserve-game --film-output portfolio-source/film/.build
```

我以 1920 × 1080 从时间 `帧号 / 30` 取样，编码 750 帧并混入配乐。加 `--frames` 可保存逐帧 JPEG，加 `--clean` 可另导出纯场景 MP4。加 `--software` 可走 Chromium 软件 WebGL。用系统 Chromium 时可设置 `CHROME_PATH`。普通 Pages 构建直接校验并复用发布归档中的影片。
