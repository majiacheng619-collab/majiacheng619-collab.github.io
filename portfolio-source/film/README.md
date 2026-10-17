# 我的一分钟介绍影片

我在仓库根目录构建当前网站与介绍影片。我先检查缓存：输入完全一致时复用当前成片；只有需要重新渲染时，才安装完整的影片依赖。

```sh
python3 -m pip install Pillow numpy opencc-python-reimplemented
python3 portfolio-source/film/cache_probe.py
python3 portfolio-source/prepare_release.py
```

我需要重新渲染影片时，先补齐系统与 GPU 依赖，再运行同一个构建入口：

```sh
sudo apt-get update
sudo apt-get install -y ffmpeg fonts-noto-cjk libegl1 libgl1-mesa-dri
python3 -m pip install moderngl glcontext
python3 portfolio-source/prepare_release.py
```

我用 `render.py` 维护完整语义句、分镜时间、词级字幕、编码和资源发布；用 `scenes_v3.py` 编排镜头，用 `optical.py` 渲染玻璃折射、Fresnel 反射、体吸收和棚灯，用 `mix_v3.py` 混合旁白与音乐并测量响度。这些文件共同生成当前影片；文件名中的版本标识不代表另存的旧版本。

我的当前输入包括 `inputs/narrator-v3.flac`、对应逐词时间 JSON、`inputs/game-demo.mp4`，以及发布包内的成长素材、活动海报、荣誉凭证与环境音乐。我保留这些必要输入，以便复现当前作品。我的原始参考录音、声纹嵌入、语音模型权重与访问密钥不放入公开仓库。

我将成片、封面和 WebVTT 按内容哈希写入 `site/assets/media/`，输出规格为 1920 × 1080、60 fps、60 秒、H.264/AAC。我用 `film-manifest.json` 向网页构建器传递当前资源入口，用 `timeline.json` 保存当前影片的分镜与字幕时间。我用 `provenance.json` 记录当前输入与成片的 SHA-256，只有全部校验一致时才允许不改变成片的维护更新复用缓存。我的中文字体默认采用 Noto Sans CJK SC，也可用 `FILM_FONT` 与 `FILM_FONT_BOLD` 指定本地字体。

我从唯一的当前 `deploy.zip` 恢复素材，再构建、检查并重新生成发布包与 `_site/`。我在重新构建前先归档需要保留的临时成果，避免构建器覆盖尚未保存的内容。

我在素材恢复后，可用 `python3 portfolio-source/film/render.py --contact` 生成检查图；用 `--audio-only` 基于 `.build/film.mp4` 重封装混音；用 `--skip-render` 重新打包本地成片。我不提交 `.build/` 中的临时帧、混音与测量报告。

我在发布前核对画面、字幕安全区、完整解码与编码规格，发布后核对 `release.json`、视频 SHA-256、资源引用与 Pages 部署。我用声音测量检查响度与峰值，并保留人工听审。
