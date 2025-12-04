# Bilibili视频热度分析工具

一个基于 Python 和 Node.js 的 Bilibili 视频热度分析工具，用于爬取指定关键词的视频数据并生成热度趋势图表。

## 项目结构

```
project1/
├── crawler.py              # Bilibili 视频爬虫核心模块
├── crawler_api.py          # Flask API 服务（处理爬取请求）
├── server.js               # Node.js Express 后端服务
├── package.json            # Node.js 项目配置
├── package-lock.json       # Node.js 依赖锁定文件
├── requirements.txt        # Python 项目依赖
├── public/
│   ├── index.html          # 前端页面
│   ├── script.js           # 前端 JavaScript 代码
│   └── style.css           # 前端样式
└── project_explain/        # 项目说明文档目录
```

## 功能特点

1. **视频数据爬取**：通过 Bilibili API 爬取指定关键词的视频数据
2. **多线程处理**：使用线程池并发处理视频详情获取，提高爬取效率
3. **异步任务管理**：支持异步爬取任务，可查询任务进度
4. **热度趋势分析**：按年份统计视频平均热度并生成折线图
5. **数据可视化**：使用 Chart.js 绘制直观的热度趋势图表
6. **双服务器架构**：Node.js 前端服务 + Flask 爬虫 API 服务
7. **响应式设计**：适配不同屏幕尺寸的设备

## 技术栈

- **后端服务**：Node.js, Express
- **爬虫 API**：Python, Flask
- **数据爬取**：Requests, ThreadPoolExecutor
- **前端**：HTML, CSS, JavaScript, Chart.js
- **数据请求**：Fetch API (JavaScript)

## 安装与运行

### 1. 安装依赖

#### Python 依赖
```bash
pip install -r requirements.txt
```

#### Node.js 依赖
```bash
npm install
```

### 2. 启动服务

#### 启动爬虫 API 服务（Flask）
```bash
python crawler_api.py
```
爬虫 API 服务将在 `http://localhost:5000` 启动。

#### 启动前端服务（Node.js Express）
```bash
node server.js
```
前端服务将在 `http://localhost:3000` 启动。

### 3. 访问应用

打开浏览器，访问 `http://localhost:3000`

## API 接口说明

### POST /api/crawl（Node.js 服务）

代理请求到 Flask 爬虫 API，用于爬取指定关键词的视频数据。

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| keyword | string | 是 | 搜索关键词 |
| pages | number | 是 | 爬取页数（1-20） |
| delay | number | 否 | 请求延迟时间（默认：0.5秒） |

#### 响应示例

```json
{
  "status": "success",
  "data": {
    "task_id": "task_1234567890"
  }
}
```

### GET /api/task/:task_id

获取爬取任务的状态。

#### 响应示例

```json
{
  "status": "running",
  "data": {
    "current_page": 3,
    "total_pages": 5
  }
}
```

### GET /api/progress/:task_id

获取爬取任务的进度信息。

#### 响应示例

```json
{
  "status": "success",
  "data": {
    "progress": "60%",
    "current_page": 3,
    "total_pages": 5
  }
}
```

### GET /api/result/:task_id

获取爬取任务的结果数据。

#### 响应示例

```json
{
  "status": "completed",
  "data": {
    "videos": [
      {
        "title": "视频标题",
        "bvid": "BV1234567890",
        "pubdate": 1640995200,
        "play": 1995000,
        "like": 15000,
        "coin": 8000,
        "favorite": 23000,
        "up_name": "UP主名称",
        "up_fans": 0
      }
    ],
    "total_videos": 100,
    "total_pages": 5
  }
}
```

## 使用说明

1. 在搜索框中输入要分析的关键词
2. 选择要爬取的页数（1-20页）
3. 点击"开始爬取"按钮
4. 查看爬取进度
5. 爬取完成后，查看热度趋势图表和视频列表
6. 可以查看统计摘要，了解爬取到的视频总数、总播放量等信息

## 热度计算方式

热度 = 播放量 × 0.4 + 点赞数 × 0.2 + 投币数 × 0.2 + 收藏数 × 0.2

## 核心功能实现

### 1. 爬虫核心（crawler.py）

- `search_videos()`: 搜索指定关键词的视频
- `get_video_detail()`: 获取视频详细信息
- `get_up_info()`: 获取UP主信息
- `get_up_fans()`: 获取UP主粉丝数
- `crawl_bilibili_videos_with_progress()`: 主爬取函数，支持进度回调
- `process_video()`: 处理单个视频信息（多线程处理）

### 2. 爬虫 API（crawler_api.py）

- `/api/crawl`: 接收爬取请求，创建异步任务
- `crawl_bilibili_videos_with_progress()`: 异步爬取任务实现
- `update_progress()`: 更新爬取进度
- `/api/task/<task_id>`: 获取任务状态
- `/api/progress/<task_id>`: 获取爬取进度
- `/api/result/<task_id>`: 获取爬取结果

### 3. 前端服务（server.js）

- 静态文件服务：提供前端页面访问
- API 代理：将前端请求转发到 Flask 爬虫 API
- 错误处理：统一处理请求错误

## 性能优化

1. **多线程爬取**：使用 `ThreadPoolExecutor` 并发处理视频详情获取，提高爬取效率
2. **TCP 连接复用**：使用全局 `requests.Session` 对象复用 TCP 连接
3. **异步任务管理**：将爬取任务放入线程中执行，避免阻塞 API 响应
4. **进度更新机制**：实时更新爬取进度，提升用户体验
5. **请求延迟优化**：合理设置请求间隔，避免对 Bilibili 服务器造成过大压力

## 注意事项

1. 请不要频繁爬取数据，以免给 Bilibili 服务器造成压力
2. 爬取页数建议控制在 1-5 页，避免请求过多导致被限制访问
3. 如果遇到爬取失败的情况，请稍后重试
4. 项目仅供学习和研究使用，请勿用于商业用途

## 许可证

MIT
