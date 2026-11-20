# 马嘉程个人网站

- [个人网站](https://majiacheng619-collab.github.io/)
- [业务经历](https://majiacheng619-collab.github.io/experience/)
- [作品](https://majiacheng619-collab.github.io/projects/)
- [个人简历](https://majiacheng619-collab.github.io/resume-beb4a3432690.pdf)
- [改版验收与截图](docs/REVIEW.md)

## 构建与校验

本地需 Python 3.12、Node.js 24 和 Java 21。

```sh
python3 -m pip install -r requirements-build.txt
npm ci --ignore-scripts
npm run check
```

构建将共享页面、媒体和独立游戏合并到 `_site`。源简历是根目录的 `resume.pdf`，发布时使用内容指纹文件名。`deploy.zip` 保存已发布的媒体与游戏，是下次构建的输入。发布 workflow 在 HTML、链接、服务工作线程资源和游戏存档测试通过后部署，并将发布归档同步到主分支。
