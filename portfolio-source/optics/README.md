# 我的实时玻璃光场

`generate_field.py` 生成 12 个采样程序，含 1,228,800 行可执行采样语句，覆盖 1280 × 960 个不同坐标。这些是可复现的生成源码，不是手写的百万项独立功能。

此前采样结果只生成静态 WebP，未体现实时作用。本版逐一执行全部采样，将其高度值与有限差分法线编码为约 103 KB 的 PNG 运行纹理。`optical-runtime.js` 将整张纹理上传 GPU，片元着色器持续采样高度和法线，结合时间、指针位置及触摸波纹计算光场。个人网站和游戏资料页共用这一效果；游戏内种植、收阳光、开花和施放雨露也会触发光场反馈。

百万行 Python 在构建时执行，手机加载的是其计算结果与共享渲染器。此设计让全部采样的结果参与运行时画面，同时避免向访客发送六十多兆字节的 Python。生成代码量仍与界面质量分别验收。

运行时只绘制低分辨率背景，控制帧率，页面隐藏时暂停；遵循减少动态效果、减少透明度及提高对比度偏好。WebGL 不可用时保留 CSS 和静态材质。游戏的运行纹理放在自身离线缓存中，不依赖联网服务。

复现与验证：

```sh
python3 portfolio-source/optics/generate_field.py --check
python3 -m unittest discover -s portfolio-source -p optics_test.py
python3 portfolio-source/prepare_release.py
node portfolio-source/game-repair-audit.cjs _site
```

浏览器验收比较真正渲染的像素，检查时间变化、触摸输入、减少动态效果停帧，以及手机上的游戏教程、点击范围、继续战斗与对比度。

我参考公开的材质设计思路，用 Web 技术实现透明视觉；不使用 Apple 原生材质 API，也不表示官方认证。
