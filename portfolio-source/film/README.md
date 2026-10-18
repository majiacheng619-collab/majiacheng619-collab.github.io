# 我的 24 秒作品影片

我将有限的作品信息收紧为 24 秒，用真实三维字形、摄影机运动和真实作品素材构建影片。我的游戏画面只出现一次，长度 2.2 秒。我的当前配乐来自已授权的 Adobe Stock 录制曲目，不再使用程序合成循环或白噪声转场。

我的交付包含两种规格：制作母版为 1920 × 1080、480 fps、11,520 帧；网页播放版为 1920 × 1080、60 fps、1,440 帧。每个母版时间点均实际执行场景渲染，网页版本积分每组中间四帧以形成 180 度快门效果。我保存实际帧数、唯一像素哈希数量与哈希序列摘要；帧数不作为创作质量的证明。

我使用以下构建流程：

```sh
python3 -m pip install Pillow numpy opencc-python-reimplemented moderngl glcontext contourpy
python3 portfolio-source/prepare_release.py
python3 portfolio-source/audit_repository.py
```

我需要系统提供 FFmpeg、EGL 与 Mesa 软件渲染支持，影片默认使用 `LP_NUM_THREADS=2` 与两个独立渲染进程。`FILM_WORKERS` 可调整进程数。我让每个进程独立初始化 GL，避免跨进程共享上下文。完整制作母版和逐帧哈希只保存在本地构建与个人交付文件中；公开网站使用适合正常播放的 60 fps 成片。

我用 `scenes_v3.py` 维护几何、字形轮廓、灯光、纸张弯曲与摄影机；用 `render.py` 逐帧渲染、积分、编码与发布；用 `mix_v3.py` 校验授权录制音轨并复制当前同步成片中的同一 AAC 数据。文件名保持构建入口兼容，不代表另存旧版成片。我保留原始授权素材的身份与剪辑记录，公开仓库不保存可独立使用的原始 Stock 音频。

我以 `film-build.json`、`timeline.json` 和 `provenance.json` 校验当前输入与输出。当前发布包包含后续构建所需的同步影片。首次更换配乐时，我在本地通过 `FILM_SCORE_FILE` 指定已授权并剪辑的私有声音源，再记录其 AAC 指纹。该本地输入不得提交公开仓库。

我用 `--contact` 生成画面检查图，用 `--skip-render` 发布已完成并验证的本地影片。我在 `.build/verification.json` 记录母版与播放版规格，在 `.build/frame-hashes.txt` 保存逐帧摘要；临时帧、独立音频和编码分段不提交仓库。我在正常速度的画面检查之外，分别检查声音来源、编码、转场、文字安全区及网页播放行为。

我在首次发布时将同步成片分片放入临时 release-seed，由构建器逐片校验并恢复，再通过既有流程归入当前发布包并移除临时种子。
