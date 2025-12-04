#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B站视频爬虫模块
功能：通过关键词检索B站视频并爬取相关数据
包含视频标题、BV号、发布时间、播放量、点赞数、投币数、收藏数、UP主和粉丝数等信息
"""

import requests
import time
import threading
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor

# 创建全局Session对象，用于复用TCP连接，提高请求效率
SESSION = requests.Session()

# 设置请求头
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Referer': 'https://www.bilibili.com/',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
}

# Bilibili API URLs
VIDEO_DETAIL_URL = 'https://api.bilibili.com/x/web-interface/view'
UPINFO_URL = 'https://api.bilibili.com/x/space/acc/info'
UP_FANS_URL = 'https://api.bilibili.com/x/relation/stat'


def crawl_bilibili_videos(keyword, pages=1, delay=0.5):
    """
    爬取B站视频数据
    
    参数：
        keyword (str): 搜索关键词
        pages (int): 爬取页数，默认为5页
        delay (float): 请求间隔延迟（秒），默认0.5秒
        
    返回：
        list: 包含视频信息的字典列表
    """
    return crawl_bilibili_videos_with_progress(keyword, pages, delay, None)


def process_video(video, delay):
    """
    处理单个视频
    
    参数：
        video (dict): 视频基本信息
        delay (float): 请求间隔延迟（秒）
        
    返回：
        dict: 处理后的视频数据
    """
    try:
        # 构建视频数据 - 确保时间戳有效
        pubdate = video.get('pubdate', video.get('senddate', 0))
        bvid = video.get('bvid', '')
        
        # 尝试获取视频详细信息以获取投币数
        video_detail = {}
        if bvid:
            try:
                video_detail = get_video_detail(bvid)
                time.sleep(delay)  # 减少延迟，提高效率
            except Exception:
                pass  # 静默处理异常，继续处理其他视频
        
        # 构建视频数据
        return {
            'title': video.get('title', ''),
            'bvid': bvid,
            'pubdate': pubdate,
            'play': video_detail.get('view', 0) or video.get('play', 0),
            'like': video_detail.get('like', 0) or video.get('like', 0),
            'coin': video_detail.get('coin', 0),  # 从详细信息中获取投币数
            'favorite': video_detail.get('favorite', 0) or video.get('favorites', 0),
            'up_name': video.get('author', ''),
            'up_fans': 0  # 需要额外调用API获取
        }
    except Exception:
        return None


def crawl_bilibili_videos_with_progress(keyword, pages=1, delay=0.5, progress_callback=None):
    """
    爬取B站视频数据（支持进度回调）
    
    参数：
        keyword (str): 搜索关键词
        pages (int): 爬取页数，默认为5页
        delay (float): 请求间隔延迟（秒），默认0.5秒
        progress_callback (callable): 进度回调函数，接收(current_page, total_pages)参数
        
    返回：
        list: 包含视频信息的字典列表
    """
    print(f'正在爬取B站关于 "{keyword}" 的视频数据，共 {pages} 页...')
    
    all_videos = []
    
    # 遍历指定页数
    for page in range(1, pages + 1):
        try:
            # 搜索视频
            search_result = search_videos(keyword, page=page)
            
            # 检查搜索结果
            if 'data' not in search_result or 'result' not in search_result['data']:
                continue
            
            # 获取视频列表 - 处理B站API的实际返回格式
            result_dict = search_result['data']['result']
            if not result_dict:
                continue
            
            # 从结果中获取视频类型的数据
            videos = result_dict.get('video', [])
            
            # 如果没有找到视频，跳过当前页
            if not videos:
                continue
            
            print(f'第 {page} 页找到 {len(videos)} 个视频')
            
            # 使用多线程处理视频列表
            with ThreadPoolExecutor(max_workers=5) as executor:
                # 创建任务列表
                futures = [executor.submit(process_video, video, delay) for video in videos]
                
                # 获取处理结果
                for future in futures:
                    video_data = future.result()
                    if video_data:
                        all_videos.append(video_data)
            
            # 调用进度回调
            if progress_callback:
                progress_callback(page, pages)
            
            # 添加页面间延迟
            if page < pages:  # 最后一页不需要延迟
                time.sleep(delay)  # 减少页面间延迟
                
        except Exception:
            continue  # 静默处理异常，继续爬取下一页
    
    print(f'爬取完成，共获取 {len(all_videos)} 个视频')
    return all_videos


def convert_to_number(text):
    """
    将文本形式的数字转换为整数
    例如：'10.5万' -> 105000，'1,234' -> 1234
    
    参数：
        text (str): 文本形式的数字
        
    返回：
        int: 转换后的整数
    """
    if not text or not isinstance(text, str):
        return 0
    
    # 移除逗号
    text = text.replace(',', '')
    
    # 处理万为单位的数字
    if '万' in text:
        try:
            return int(float(text.replace('万', '')) * 10000)
        except (ValueError, TypeError):
            return 0
    
    # 处理其他数字
    try:
        return int(text)
    except (ValueError, TypeError):
        return 0


def search_videos(keyword, page=1, page_size=20):
    """
    搜索B站视频 - 使用API方式
    
    参数：
        keyword (str): 搜索关键词
        page (int): 页码，默认为1
        page_size (int): 每页大小，默认为20
        
    返回：
        dict: 包含视频列表的字典，格式与API返回一致
    """
    # 使用B站视频搜索API
    API_URL = 'https://api.bilibili.com/x/web-interface/search/all'
    
    # 构建API请求参数
    params = {
        'keyword': keyword,
        'page': page,
        'page_size': page_size,
        'order': 'pubdate',  # 按发布时间排序
        'platform': 'pc'
    }
    
    # 使用全局SESSION对象发送请求，复用TCP连接
    try:
        response = SESSION.get(
            API_URL, 
            headers=HEADERS, 
            params=params, 
            timeout=15
        )
        response.raise_for_status()
        return response.json()
        
    except requests.exceptions.HTTPError:
        # 如果API请求失败，返回空结果
        return {
            'data': {
                'result': {}
            },
            'code': 0,
            'message': 'success'
        }
    except Exception:
        # 静默处理异常，返回空结果
        return {
            'data': {
                'result': {}
            },
            'code': 0,
            'message': 'success'
        }


def get_video_detail(bvid):
    """
    获取视频详细信息
    
    参数：
        bvid (str): 视频的bvid
        
    返回：
        dict: 包含播放量、点赞数、投币数、收藏数的字典
    """
    params = {'bvid': bvid}
    
    try:
        response = SESSION.get(
            VIDEO_DETAIL_URL, 
            headers=HEADERS, 
            params=params, 
            timeout=10
        )
        response.raise_for_status()
        return response.json().get('data', {}).get('stat', {})
    except Exception:
        # 静默处理异常，返回空字典
        return {}


def get_up_info(mid):
    """
    获取UP主基本信息
    
    参数：
        mid (int): UP主的mid
        
    返回：
        dict: 包含UP主名称的字典
    """
    params = {'mid': mid}
    
    try:
        response = SESSION.get(
            UPINFO_URL, 
            headers=HEADERS, 
            params=params, 
            timeout=10
        )
        response.raise_for_status()
        data = response.json().get('data', {})
        return {'name': data.get('name', '')}
    except Exception:
        # 静默处理异常，返回默认值
        return {'name': ''}


def get_up_fans(mid):
    """
    获取UP主粉丝数
    
    参数：
        mid (int): UP主的mid
        
    返回：
        dict: 包含粉丝数的字典
    """
    params = {'vmid': mid}
    
    try:
        response = SESSION.get(
            UP_FANS_URL, 
            headers=HEADERS, 
            params=params, 
            timeout=10
        )
        response.raise_for_status()
        data = response.json().get('data', {})
        return {'fans': data.get('follower', 0)}
    except Exception:
        # 静默处理异常，返回默认值
        return {'fans': 0}


if __name__ == '__main__':
    """
    程序主入口 - 用于测试爬虫功能
    """
    try:
        # 测试爬取视频功能
        keyword = "游戏"
        videos = crawl_bilibili_videos(keyword, pages=1)
        
        # 打印视频列表
        print(f"共获取 {len(videos)} 个视频")
        if videos:
            print("视频列表:")
            for video in videos[:5]:  # 只打印前5个视频
                print(f"标题: {video['title']}")
                print(f"BV号: {video['bvid']}")
                print(f"UP主: {video['up_name']}")
                print(f"播放量: {video['play']}")
                print(f"点赞数: {video['like']}")
                print(f"投币数: {video['coin']}")
                print(f"收藏数: {video['favorite']}")
                print("-" * 50)
        
    except Exception as e:
        print(f"测试失败: {str(e)}")
        import traceback
        traceback.print_exc()