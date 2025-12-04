# Bilibili视频热度分析工具 - 部署指南

本指南将详细介绍如何在Render等云平台上部署Bilibili视频热度分析工具。

## 项目架构

本项目采用双服务器架构：

1. **前端服务**：基于Node.js和Express，提供静态文件服务和API代理
2. **爬虫API服务**：基于Python和Flask，提供视频爬取功能

## 部署方案

### 方案一：单容器部署（推荐）

使用Docker容器将两个服务打包在一起部署，这是在Render上部署的推荐方式。

#### 步骤1：准备项目

确保项目中包含以下文件：

- `Dockerfile`：用于构建Docker镜像
- `docker-compose.yml`：用于定义服务配置
- `requirements.txt`：Python依赖
- `package.json`：Node.js依赖
- `server.js`：Node.js前端服务
- `crawler_api.py`：Python爬虫API服务

#### 步骤2：配置Dockerfile

项目中已经包含了Dockerfile，它会：

1. 使用包含Node.js和Python的基础镜像
2. 安装Python和Node.js依赖
3. 暴露必要的端口（3000和5000）
4. 同时启动两个服务

#### 步骤3：配置环境变量

可以通过环境变量配置以下参数：

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| PYTHON_CRAWLER_API | Python爬虫API地址 | http://localhost:5000 |
| PORT | Node.js服务端口 | 3000 |

#### 步骤4：在Render上部署

1. **登录Render账户**
2. **创建新服务**：
   - 选择"Web Service"类型
   - 连接到GitHub/GitLab仓库
   - 选择仓库分支（通常是main）
3. **配置服务**：
   - 名称：为服务命名
   - 环境：选择"Docker"
   - 构建命令：留空（Render会自动使用Dockerfile）
   - 启动命令：留空（Render会自动使用Dockerfile中的CMD命令）
   - 端口：确保Render检测到端口3000
4. **配置环境变量**（可选）：
   - 添加需要的环境变量
5. **部署服务**：
   - 点击"Create Web Service"
   - Render会开始构建和部署服务

#### 步骤5：验证部署

部署完成后，可以通过Render提供的URL访问应用：

- 前端应用：`https://your-service-name.onrender.com`
- API端点：`https://your-service-name.onrender.com/api/crawl`

### 方案二：多容器部署

如果需要将两个服务部署为独立的容器，可以使用Render的多个服务功能。

#### 步骤1：部署爬虫API服务

1. 创建一个新的Web Service
2. 选择"Python"环境
3. 配置：
   - 构建命令：`pip install -r requirements.txt`
   - 启动命令：`python crawler_api.py`
   - 端口：5000
4. 部署服务，获取服务URL（如：`https://bilibili-crawler-api.onrender.com`）

#### 步骤2：部署前端服务

1. 创建另一个新的Web Service
2. 选择"Node.js"环境
3. 配置：
   - 构建命令：`npm install`
   - 启动命令：`node server.js`
   - 端口：3000
4. 添加环境变量：
   - `PYTHON_CRAWLER_API=https://bilibili-crawler-api.onrender.com`
5. 部署服务

#### 步骤3：验证部署

- 前端应用：`https://your-frontend-service.onrender.com`
- 爬虫API：`https://bilibili-crawler-api.onrender.com`

## 常见问题与解决方案

### 1. 服务无法启动

**解决方案**：
- 检查Render日志，查看具体错误信息
- 确保所有依赖都已正确安装
- 检查端口配置是否正确

### 2. 爬虫API无法访问

**解决方案**：
- 确保Python服务正在运行
- 检查前端服务中的环境变量是否正确配置了API地址
- 检查API端点是否正确

### 3. 爬取数据失败

**解决方案**：
- 检查网络连接和API请求限制
- 调整请求延迟参数（delay）
- 查看Python服务日志，分析具体错误

### 4. 前端页面无法加载

**解决方案**：
- 确保静态文件路径配置正确
- 检查浏览器控制台，查看网络请求和错误
- 确保Node.js服务正在正常运行

## 性能优化建议

1. **增加请求延迟**：如果遇到API请求限制，可以增加延迟参数
2. **减少爬取页数**：默认爬取5页，可以根据需求调整
3. **优化数据库查询**：如果有数据库操作，确保查询高效
4. **使用缓存**：对频繁访问的数据进行缓存

## 监控与维护

1. **查看日志**：通过Render控制台查看服务日志
2. **性能监控**：使用Render的性能监控功能
3. **定期更新**：定期更新依赖和代码
4. **备份数据**：如果有数据存储，定期备份

## 联系方式

如果在部署过程中遇到问题，请查看项目的README.md文件或联系项目维护者。
