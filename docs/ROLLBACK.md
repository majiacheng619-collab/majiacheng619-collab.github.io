# Pages 回滚

我用 `pre-ios27` 标记上线前 `main` 中与线上发布元数据一致的版本。Pages 由 GitHub Actions 从 `main` 打包并发布 `_site`。上线前预检会核对设置、线上版本和 tag。

## 三条命令

在有推送权限的仓库检出目录执行。以下命令为旧发布树创建一条新提交，保留完整历史。回滚分支名应尚未使用。

```sh
git fetch origin refs/heads/main:refs/remotes/origin/main refs/tags/pre-ios27:refs/tags/pre-ios27
git update-ref refs/heads/rollback-ios27 "$(git commit-tree 'refs/tags/pre-ios27^{tree}' -p refs/remotes/origin/main -m 'Restore pre-ios27 Pages release')" ''
git push origin refs/heads/rollback-ios27:refs/heads/main
```

## 验证

1. 等待 Pages 工作流成功，用带新查询参数的 `/release.json` 检查 `siteRevision`、简历指纹和影片指纹与标签中的 `deploy.zip` 一致。回滚重建会记录新回滚提交。
2. 保持一个曾装载新版的浏览器会话。恢复网络、回到标签页或访问站点后，确认打开旧首页。停留在可见页面上的检查最多等一分钟。
3. 在浏览器 Application 面板核对主站 Service Worker 已注销，`mjc-os-static-*` 缓存已删除。游戏的独立缓存和本地存档仍可用。临时断网不会触发清理。网络取到 `/sw-state.json` 的 404、410 或明确的禁用值才会触发。

需要紧急停用离线功能时，当前版本也可发布 `/sw-state.json` 的 `{"enabled":false}`。回滚到标签时旧版本自然没有该文件。
