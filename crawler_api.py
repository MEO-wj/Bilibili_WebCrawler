#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B站视频爬虫API服务
功能：接收HTTP请求，执行爬虫任务并返回结果
提供RESTful API接口，支持关键词搜索和多页爬取
"""

from flask import Flask, request, jsonify, send_from_directory
import time
import threading
import uuid

# 创建Flask应用
app = Flask(__name__, static_folder='public', static_url_path='')

# 导入爬虫函数
from crawler import crawl_bilibili_videos_with_progress

# 根路由，返回index.html
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')


# 用于存储爬取任务的字典
tasks = {}

@app.route('/api/crawl', methods=['POST'])
def crawl_api():
    """
    爬虫API端点
    接收POST请求，获取关键词和页数参数，执行爬取任务并返回结果
    
    请求体格式：
    {"keyword": "搜索关键词", "pages": 5, "delay": 0.5}
    
    返回格式：
    {"status": "success", "task_id": "任务ID"}
    或
    {"status": "error", "message": "错误信息"}
    """
    try:
        # 获取请求参数
        data = request.get_json() or {}
        
        keyword = data.get('keyword')
        pages = data.get('pages', 5)
        delay = data.get('delay', 0.5)
        
        # 参数验证
        if not keyword or not isinstance(keyword, str) or keyword.strip() == "":
            return jsonify({"status": "error", "message": "关键词不能为空"}), 400
        
        if not isinstance(pages, int) or pages < 1 or pages > 100:
            return jsonify({"status": "error", "message": "页数必须为1-100之间的整数"}), 400
        
        # 生成唯一任务ID
        task_id = str(uuid.uuid4())
        
        # 存储任务信息
        tasks[task_id] = {
            'keyword': keyword.strip(),
            'pages': pages,
            'delay': delay,
            'status': 'running',
            'results': [],
            'current_page': 0,
            'total_pages': pages
        }
        
        # 启动异步爬取任务
        def crawl_task():
            try:
                # 执行爬取任务
                results = crawl_bilibili_videos_with_progress(
                    keyword.strip(), 
                    pages, 
                    delay, 
                    lambda current, total: update_progress(task_id, current, total)
                )
                
                # 更新任务状态
                tasks[task_id]['status'] = 'completed'
                tasks[task_id]['results'] = results
                tasks[task_id]['total'] = len(results)
                
            except Exception as e:
                # 更新任务状态为失败
                tasks[task_id]['status'] = 'failed'
                tasks[task_id]['error'] = str(e)
        
        # 启动线程执行爬取任务
        thread = threading.Thread(target=crawl_task)
        thread.daemon = True
        thread.start()
        
        # 返回任务ID
        return jsonify({
            "status": "success",
            "task_id": task_id
        })
        
    except ValueError as e:
        # 参数错误
        return jsonify({"status": "error", "message": str(e)}), 400
    except Exception as e:
        # 服务器错误
        return jsonify({"status": "error", "message": "服务器内部错误"}), 500


def update_progress(task_id, current_page, total_pages):
    """
    更新爬取进度
    """
    if task_id in tasks:
        tasks[task_id]['current_page'] = current_page
        tasks[task_id]['total_pages'] = total_pages


@app.route('/api/task/<task_id>', methods=['GET'])
def get_task_status(task_id):
    """
    获取任务状态（支持HTTP轮询）
    """
    if task_id in tasks:
        return jsonify(tasks[task_id])
    else:
        return jsonify({"status": "error", "message": "任务不存在"}), 404

@app.route('/api/progress/<task_id>', methods=['GET'])
def get_progress(task_id):
    """
    获取爬取进度
    """
    if task_id in tasks:
        return jsonify({
            "status": "success",
            "data": {
                "task_id": task_id,
                "current_page": tasks[task_id]['current_page'],
                "total_pages": tasks[task_id]['total_pages'],
                "status": tasks[task_id]['status']
            }
        })
    else:
        return jsonify({"status": "error", "message": "任务不存在"}), 404

@app.route('/api/result/<task_id>', methods=['GET'])
def get_result(task_id):
    """
    获取爬取结果
    """
    if task_id not in tasks:
        return jsonify({"status": "error", "message": "任务不存在"}), 404
    
    task = tasks[task_id]
    
    if task['status'] == 'running':
        return jsonify({"status": "error", "message": "任务正在执行中"}), 400
    
    if task['status'] == 'failed':
        return jsonify({"status": "error", "message": task.get('error', '爬取失败')}), 500
    
    return jsonify({
        "status": "success",
        "data": task['results'],
        "total": task.get('total', len(task['results']))
    })


if __name__ == '__main__':
    """
    启动Flask服务器
    """
    # 生产环境建议关闭debug=True
    app.run(host='0.0.0.0', port=5000, debug=False)