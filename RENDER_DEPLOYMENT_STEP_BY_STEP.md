# Render 平台部署指南（详细步骤）

## 1. 创建新的 Web 服务
1. 登录 Render 控制台
2. 点击右上角的 `New` → `Web Service`
3. 选择您的 GitHub 仓库：`MEO-Wu/Bilibili_WebCrawler`
4. 选择分支：`main`

## 2. 基本配置填写

| 配置项 | 填写内容 | 说明 |
|-------|---------|------|
| **Service Type** | `Web Service` | 选择 Web 服务类型 |
| **Name** | `Bilibili_WebCrawler` | 服务名称，可自定义 |
| **Environment** | `Docker` | 必须选择 Docker 环境！ |
| **Region** | 建议选择离您最近的地区，如 `Virginia (US East)` 或 `Singapore` | 部署地区 |
| **Root Directory** | 留空 | 必须留空，确保Render在仓库根目录查找Dockerfile |
| **Dockerfile Path** | `Dockerfile` | 明确指定Dockerfile文件名，确保Render能找到 |

## 3. 环境变量配置![alt text](image-1.png)

在 "Environment Variables" 部分，点击 "Add Environment Variable" 添加以下环境变量：

| 变量名 | 值 | 说明 |
|-------|-----|------|
| `PYTHON_CRAWLER_API` | `http://localhost:5000` | Python 爬虫 API 地址，容器内使用 localhost |
| `PORT` | `3000` | Node.js 服务端口，必须与 Dockerfile 中暴露的端口一致 |

## 4. Build Command 和 Start Command

**重要提示：** 由于我们使用 Docker 环境，并且 Dockerfile 中已经包含了完整的构建和启动逻辑，因此这两个字段应该**留空**！

- **Build Command**: 留空（Render 会自动使用 Dockerfile 中的 `COPY`、`RUN` 指令）
- **Start Command**: 留空（Render 会自动使用 Dockerfile 中的 `CMD` 指令）

## 5. 其他高级配置（可选）

- **Auto Deploy**: 建议开启，当您推送代码到 GitHub 时自动重新部署
- **Instance Type**: 选择 `Free` 或根据需要选择付费类型
- **Disk**: 无需配置，Free 类型默认提供磁盘

## 6. 部署

1. 确认所有配置正确后，点击 `Create Web Service` 按钮
2. 部署过程将开始，您可以在控制台查看实时部署日志

## 7. 部署成功检查

1. 部署完成后，状态会变为 `Live`
2. 您会看到一个公共 URL，格式为 `https://bilibili-webcrawler-XXXX.onrender.com`
3. 访问该 URL，应该能看到 Bilibili 视频分析工具的前端界面
4. 测试爬取功能，确认 Python API 和 Node.js 服务都正常工作

## 8. 常见问题排查

### 如果部署失败：
1. 查看部署日志，寻找错误信息
2. 检查 Dockerfile 是否在仓库根目录
3. 确保 Dockerfile 语法正确
4. 检查环境变量设置是否正确

### 如果服务运行但功能异常：
1. 检查 Render 控制台的服务日志
2. 确认两个服务都已启动
3. 检查 `PYTHON_CRAWLER_API` 环境变量是否设置为 `http://localhost:5000`

## 9. 关于 Dockerfile 的说明

我们的 Dockerfile 已经包含了完整的部署逻辑：

```dockerfile
# 使用包含 Node.js 和 Python 的基础镜像
FROM nikolaik/python-nodejs:python3.11-nodejs20

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 安装 Python 依赖
RUN pip install -r requirements.txt

# 安装 Node.js 依赖
RUN npm install

# 暴露端口
EXPOSE 3000
EXPOSE 5000

# 启动命令，同时运行两个服务
CMD python crawler_api.py & node server.js
```

这个 Dockerfile 会：
1. 使用同时包含 Python 3.11 和 Node.js 20 的基础镜像
2. 安装所有 Python 和 Node.js 依赖
3. 暴露端口 3000（Node.js）和 5000（Python）
4. 同时启动两个服务

## 10. 部署完成后

部署完成后，您可以：
- 通过公共 URL 访问应用
- 在 Render 控制台查看服务状态和日志
- 随时重启、暂停或删除服务
- 当代码更新时，开启自动部署功能会自动重新部署

---

如果您在部署过程中遇到任何问题，请随时查看 Render 控制台的日志，或联系 Render 支持团队。