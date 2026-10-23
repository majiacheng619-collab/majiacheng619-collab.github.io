# 我的液态玻璃光场

我使用 `generate_field.py` 生成 `sample_field.py`，其中有 102,400 行可执行的逐像素采样语句；每行计算一个不同坐标的光场颜色。这些是生成代码，并非手写的十万项独立功能。

我通过 `render_field.py` 在构建阶段执行完整采样程序，把波纹、焦散与柔和色彩渲染成内容寻址的 WebP。浏览器只加载压缩图片，动态背景与玻璃控件由共享 CSS 和轻量 JavaScript 驱动，不下载采样程序。

我使用以下命令重建与验证源码：

```sh
python3 portfolio-source/optics/generate_field.py
python3 portfolio-source/optics/generate_field.py --check
python3 -m unittest discover -s portfolio-source -p optics_test.py
```

我参考 Apple 公开的 Liquid Glass 和 Materials 指南，保留清晰文字、减少动态效果、减少透明度与增强对比度的适配。网站是对玻璃视觉的 Web 实现，没有使用 Apple 原生材质 API，也不表示 Apple 官方认证。
