/**
 * Bilibili视频热度分析工具 - 前端服务
 * 
 * 基于Node.js和Express的后端服务，主要功能包括：
 * 1. 提供前端静态文件访问
 * 2. 将前端爬取请求转发到Python爬虫API
 * 3. 统一处理请求错误
 * 
 * 作者: [MEO温酒]
 * 日期: [2025.12.4]
 */

// 导入依赖模块
const express = require('express');
const path = require('path');
const axios = require('axios');

// 创建Express应用实例
const app = express();

// 设置服务器端口，优先使用环境变量PORT，否则使用3000
const PORT = process.env.PORT || 3000;

// Python爬虫API地址 - 与Flask服务保持一致
const PYTHON_CRAWLER_API = 'http://localhost:5000/api/crawl';

// 配置Axios实例，设置超时和基础URL
const apiClient = axios.create({
  baseURL: 'http://localhost:5000',
  timeout: 30000, // 设置30秒超时
  headers: {
    'Content-Type': 'application/json'
  }
});

// 设置静态文件目录，用于存放前端HTML、CSS、JavaScript等文件
app.use(express.static(path.join(__dirname, 'docs')));
// 设置node_modules为静态文件目录，以便前端访问第三方库
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// 解析JSON请求体，使req.body可以获取到JSON数据
app.use(express.json());

/**
 * 爬虫API端点
 * 接收前端的爬取请求，将请求转发到Python爬虫API
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
app.post('/api/crawl', async (req, res) => {
  try {
    // 从请求体中获取关键词、爬取页数和延迟参数
    const { keyword, pages = 5, delay = 0.5 } = req.body;
    
    // 参数验证
    if (!keyword || typeof keyword !== 'string' || keyword.trim() === '') {
      return res.status(400).json({ 
        status: "error", 
        message: '关键词不能为空' 
      });
    }
    
    if (typeof pages !== 'number' || pages < 1 || pages > 20) {
      return res.status(400).json({ 
        status: "error", 
        message: '页数必须为1-20之间的整数' 
      });
    }
    
    if (typeof delay !== 'number' || delay < 0.1 || delay > 5) {
      return res.status(400).json({ 
        status: "error", 
        message: '延迟必须为0.1-5之间的数字' 
      });
    }
    
    // 调用Python爬虫API
    console.log(`正在处理关键词: ${keyword} 的爬取请求，爬取页数: ${pages}`);
    
    // 使用apiClient发送请求
    const response = await apiClient.post('/api/crawl', { 
      keyword: keyword.trim(), 
      pages, 
      delay 
    });
    
    // 返回实际爬取结果
    res.json(response.data);
    
    console.log(`成功转发爬取请求，返回任务ID: ${response.data.task_id}`);
    
  } catch (error) {
    // 捕获并处理错误
    console.error('爬取请求处理失败:', error.message);
    
    // 根据错误类型返回不同的响应
    if (error.response) {
      // 服务器返回了错误状态码
      return res.status(error.response.status).json({
        status: "error",
        message: error.response.data.message || 'Python爬虫API返回错误'
      });
    } else if (error.request) {
      // 请求已发送但没有收到响应
      return res.status(504).json({
        status: "error",
        message: '无法连接到Python爬虫API，请确保爬虫服务已启动'
      });
    } else {
      // 请求配置错误
      return res.status(400).json({
        status: "error",
        message: '请求配置错误: ' + error.message
      });
    }
  }
});

/**
 * 任务状态API端点
 * 接收任务ID，将请求转发到Python爬虫API获取任务状态
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
app.get('/api/task/:task_id', async (req, res) => {
  try {
    const { task_id } = req.params;
    const response = await apiClient.get(`/api/task/${task_id}`);
    res.json(response.data);
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * 爬取进度API端点
 * 接收任务ID，将请求转发到Python爬虫API获取爬取进度
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
app.get('/api/progress/:task_id', async (req, res) => {
  try {
    const { task_id } = req.params;
    const response = await apiClient.get(`/api/progress/${task_id}`);
    res.json(response.data);
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * 爬取结果API端点
 * 接收任务ID，将请求转发到Python爬虫API获取爬取结果
 * @param {Object} req - Express请求对象
 * @param {Object} res - Express响应对象
 */
app.get('/api/result/:task_id', async (req, res) => {
  try {
    const { task_id } = req.params;
    const response = await apiClient.get(`/api/result/${task_id}`);
    res.json(response.data);
  } catch (error) {
    handleApiError(error, res);
  }
});

/**
 * 统一处理API错误
 * @param {Error} error - Axios错误对象
 * @param {Object} res - Express响应对象
 */
function handleApiError(error, res) {
  console.error('API请求处理失败:', error.message);
  
  if (error.response) {
    // 服务器返回了错误状态码
    return res.status(error.response.status).json({
      status: "error",
      message: error.response.data.message || 'Python爬虫API返回错误'
    });
  } else if (error.request) {
    // 请求已发送但没有收到响应
    return res.status(504).json({
      status: "error",
      message: '无法连接到Python爬虫API，请确保爬虫服务已启动'
    });
  } else {
    // 请求配置错误
    return res.status(400).json({
      status: "error",
      message: '请求配置错误: ' + error.message
    });
  }
}

/**
 * 启动服务器
 */
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`请确保Python爬虫API已启动在 ${PYTHON_CRAWLER_API}`);
});