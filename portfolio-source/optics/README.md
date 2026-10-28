# 我的实时玻璃光场

我用 1280 × 960 个采样点计算水面高度和法线，生成静态 WebP 与运行时 PNG 纹理。网站和游戏通过各自的渲染器使用这些资源，响应时间、指针和触摸输入。

正式构建逐点计算，保留九位小数坐标与分块顺序，不再保存可由生成器重建的展开采样文件。我用已发布采样结果的像素摘要验证输出一致，并检查每个坐标只被采样一次。`generate_field.py` 仅用于按需导出调试程序；导出文件不进入版本库。

我让离屏或后台页面暂停绘制，遵循减少动态效果偏好；WebGL 不可用时保留静态材质。游戏资源保留在自身离线缓存中。

我在发布前运行：

```sh
python3 -m unittest discover -s portfolio-source -p optics_test.py
python3 portfolio-source/prepare_release.py --preserve-game
```

我参考公开的材质设计思路，用 Web 技术实现透明视觉。
