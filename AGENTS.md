# NovelSiteBackend — 项目进度与注意事项

## 项目概述

基于 ixdzs8.com 作为数据源的小说阅读后端服务。所有书源数据通过 API 转发，用户数据（书架、阅读进度等）本地管理。

**技术栈**：FastAPI + SQLite (async) + httpx + JWT + BeautifulSoup

---

## 当前进度

### ✅ 已完成

- **后端代码编写**：13个 API 端点，15个文件
- **服务器部署**：`43.133.30.226:8000`，代码在 `/root/NovelSite/backend/`
- **代理 API 全部验证通过**：
  - 搜索 `/api/proxy/search?q=keyword`
  - 小说详情 `/api/proxy/novel/{id}` （title, author, cover, description, download_url）
  - 章节列表 `/api/proxy/novel/{id}/chapters`
  - 章节内容 `/api/proxy/novel/{id}/chapter/{chapter_id}`
  - 分类列表 `/api/proxy/categories`（12个分类）
  - 分类小说 `/api/proxy/category/{id}?page=1`
  - 推荐 `/api/proxy/recommendations`
  - 排行 `/api/proxy/ranking/{type}?page=1`（hot/new/end）
- **TXT 下载端点** `/api/download/{novel_id}`（服务器端缓存）
- **用户认证** `/api/auth/register`, `login`, `refresh`, `me`（JWT）
- **书架管理** `/api/bookshelf/add`, `remove`, `list`
- **阅读进度** `/api/reading/sync`, `/{novel_id}`, `/all`
- **Swagger 文档**：`http://43.133.30.226:8000/docs`

### 🔲 未完成

- Auth / 书架 / 阅读进度端点的端到端联调测试
- 前端开发
- 生产环境配置（JWT secret、HTTPS、进程守护等）

---

## 接下来要做的事

1. **前端开发** — 制作小说阅读 Web UI 或对接移动端 App
2. **TXT 下载解压** — ixdzs8.com 下载格式是 `.zip`，需要在 `txt_downloader.py` 中加入解压逻辑，提取 `.txt` 文件后再提供给用户
3. **Auth 联调** — 注册→登录→Token→书架/进度 的完整流程测试
4. **进程守护** — 用 `systemd` 或 `supervisor` 守护 uvicorn 进程，防止宕机
5. **HTTPS** — 配置 Nginx 反向代理 + Let's Encrypt SSL 证书
6. **生产配置** — 修改 JWT_SECRET、关闭 DEBUG、设置环境变量（`.env` 文件）

---

## 注意事项

### ⚠️ ixdzs8.com 网站结构

- **URL 规则**：
  - 搜索：`/bsearch?q=keyword`（GET）
  - 小说详情：`/read/{novel_id}/`
  - 章节：`/read/{novel_id}/p{num}.html`
  - 分类：`/sort/{category_id}/`
  - 排行：`/hot/`, `/new/`, `/end/`
- **作者信息**：从 `<title>` 标签解析（格式：`书名_作者:作者名_爱下电子书`）
- **封面和简介**：从 OpenGraph meta 标签获取（`og:image`, `og:description`）
- **下载链接**：格式为 `https://down7.ixdzs8.com/{novel_id}.zip`（是 zip 不是 txt！）
- **SSL 证书**：服务器连接 ixdzs8.com 时需要 `verify=False`（证书链不完整）

### ⚠️ 数据库

- 使用 SQLite，文件位于 `/root/NovelSite/backend/data/novel_site.db`
- 如果未来用户量增长，需要迁移到 PostgreSQL 或 MySQL

### ⚠️ 服务器管理

- 当前通过 `nohup` 启动，SSH 断开后进程仍在运行
- 重启服务器步骤：
  ```bash
  ssh root@43.133.30.226
  # 查找并杀死旧进程
  ss -tlnp sport = :8000   # 获取 PID
  kill -9 <PID>
  # 重启
  cd /root/NovelSite/backend
  nohup python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 > /root/NovelSite/backend.log 2>&1 &
  ```
- 查看日志：`tail -f /root/NovelSite/backend.log`

### ⚠️ 本地代码与服务器代码同步

- 本地代码路径：`D:\Projects\NovelSite\workspace\`
- 服务器代码路径：`/root/NovelSite/backend/`
- 修改代码后需要手动 SCP 上传：
  ```bash
  scp <本地文件> root@43.133.30.226:/root/NovelSite/backend/<对应路径>
  ```
- 上传后需要重启 uvicorn 才能生效

---

## 项目文件结构

```
D:\Projects\NovelSite\workspace\          (本地)
/root/NovelSite/backend/                  (服务器)
├── main.py                # FastAPI 入口
├── config.py              # 配置（JWT、DB、缓存路径、ixdzs URL）
├── database.py            # SQLAlchemy 模型（User, Bookshelf, ReadingProgress）
├── requirements.txt       # Python 依赖
├── services/
│   ├── ixdzs_client.py    # ixdzs8.com 异步 HTTP 客户端
│   ├── auth_service.py    # JWT Token + bcrypt 密码
│   └── txt_downloader.py  # TXT 下载 + 服务器端缓存
├── routers/
│   ├── proxy.py           # 代理转发（8个端点）
│   ├── download.py        # TXT 下载
│   ├── auth.py            # 用户认证
│   ├── bookshelf.py       # 书架管理
│   └── reading.py         # 阅读进度
├── data/                  # SQLite 数据库
└── cache/                 # TXT 缓存文件
```
