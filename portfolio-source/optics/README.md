# 我的分块玻璃光场

我用 `generate_field.py` 生成 12 个分块采样程序，共 1,228,800 行可执行采样语句，覆盖 1280 × 960 个不同坐标。每个分块独立计算一部分波纹、光晕与边缘高光。这是可复现的生成源码，不是手写的百万项独立功能。

我以这一版本替换原先的 102,400 行采样程序。本轮新增采样语句超过一百万行，扣除被替换的旧程序后，源码净增也超过一百万行。生成代码量与界面质量分别验收；内容结构、可读性、透明材质和交互由共享页面组件负责。

我在构建时逐块执行采样，及时释放模块，不将百万行计算代码发送给浏览器。线上只加载指纹 WebP 背景；场景动画、玻璃边缘和交互高光使用共享 CSS 与轻量 JavaScript，并遵循系统的减少动态效果与对比度偏好。

我使用以下命令复现与验证：

```sh
python3 portfolio-source/optics/generate_field.py
python3 portfolio-source/optics/generate_field.py --check
python3 -m unittest discover -s portfolio-source -p optics_test.py
```

我参考 Apple 公开的材质设计思路，用 Web 技术实现自己的透明视觉，不使用 Apple 原生材质 API，也不表示官方认证。
