# 更新日志

## 2026-06-16

### 新增

- 新增 Vercel Blob 图标缓存能力，站点 favicon 和上传资源可优先写入 Blob；未配置 Blob 写入能力时回退到 KV/Redis。
- 新增数据管理中的“缓存图标”功能，可批量将空图标、代理图标或 Google favicon 镜像为持久缓存地址。
- 图标缓存任务改为后台执行：点击按钮后立即返回任务启动状态，实际缓存过程在后台继续运行。
- 图标缓存默认处理全部候选站点，不再限制每次最多 80 个。
- 图标缓存后台任务改为自动分批处理，默认每批 40 个、批内并发 6 个，并在每批完成后写回一次导航数据。
- 资源管理改为直接读取 Vercel Blob 实际资源数据，支持展示 Blob 文件路径、大小和上传时间。
- 新增资源管理 Blob 删除能力，后台批量删除资源时会删除 Blob Store 中的真实文件。

### 优化

- 首页站点卡片标题限制为单行显示，避免长标题撑高卡片或破坏网格布局。
- 后台站点管理列表优化长文本显示，站点名称、链接、分类和描述会自动截断，避免操作按钮被挤出可视区域。
- 数据管理“缓存图标”按钮提示更清晰，会显示待处理数量、批大小和预计批次数。
- `.env.example` 增加 favicon 缓存批大小和并发数配置说明。
- 资源相关 API 完成分层重构：服务端资源业务集中到 `resource-storage`，前端请求集中到 `resource-api`，上传、列表、删除和引用检测逻辑统一复用。
- 站点管理和导航表单中的图片上传改为复用统一资源上传客户端，避免多处重复请求逻辑。
- `.env.example` 明确 `BLOB_READ_WRITE_TOKEN` 是 Blob 写入、删除、列出资源的核心凭证，`BLOB_STORE_ID` 作为 Public Store 的可选标识。

### 修复

- 修复后台接口返回 `401` 时不会自动跳转登录页的问题，现在会跳转到登录页并保留回跳地址。
- 修复数据管理操作面板中按钮内容没有垂直居中的问题。
- 修复后台站点管理中超长文本导致编辑、删除按钮位置异常的问题。

### 移除

- 删除投稿相关功能代码，包括投稿页面、投稿 API、投稿审核入口及相关类型和存储逻辑。
- 删除资源管理对历史资源记录的回退展示，未配置 Blob 写入能力时直接提示配置缺失。
- 清理 `public/assets` 下带时间戳的历史图片和 favicon 文件，避免继续维护旧的本地静态资源缓存。
- 删除未使用且接口格式过期的 `ResourceService`。

### 相关提交

- `f94ff8e` batch favicon cache background job
- `1c00bc6` run favicon cache in background
- `27c8473` limit homepage card titles to one line
- `39a4def` remove submission feature
- `8c0e310` fix admin site list text overflow
- `53b696f` add blob-backed favicon cache
- `7f24ead` fix admin auth redirect and data buttons
