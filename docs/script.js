// B站视频热度分析前端JavaScript文件
// 该文件负责处理用户交互、数据请求、数据可视化和结果展示

// 全局变量：存储热度趋势图表实例
let heatChart = null;
// 分页相关全局变量
let allVideos = [];
let currentPage = 1;
let videosPerPage = 20;
let totalPages = 0;
// 爬取进度相关全局变量
let currentCrawlPage = 1;
let totalCrawlPages = 0;
let progressTimer = null;
// SSE相关全局变量
let eventSource = null;
let currentTaskId = null;

// 缓存DOM元素引用
const domElements = {
    keyword: document.getElementById('keyword'),
    pages: document.getElementById('pages'),
    currentPage: document.getElementById('current-page'),
    totalPages: document.getElementById('total-pages'),
    loading: document.getElementById('loading'),
    searchBtn: document.getElementById('search-btn'),
    heatChart: document.getElementById('heatChart'),
    currentPageDisplay: document.getElementById('current-page-display'),
    totalPagesDisplay: document.getElementById('total-pages-display'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    resultsSummary: document.getElementById('results-summary'),
    resultsBody: document.getElementById('results-body')
};

/**
 * 开始爬取视频数据的主函数
 * 处理用户输入，调用后端API，并更新页面显示
 */
function startCrawling() {
    // 获取用户输入的搜索关键词和爬取页数
    const keyword = domElements.keyword.value;
    const pages = parseInt(domElements.pages.value);
    
    // 验证关键词输入
    if (!keyword || keyword.trim() === '') {
        showNotification('请输入搜索关键词', 'error');
        return;
    }
    
    // 验证页数输入
    if (isNaN(pages) || pages < 1 || pages > 100 ) {
        showNotification('爬取页数必须为1-100之间的整数', 'error');
        return;
    }
    
    // 显示加载状态，禁用搜索按钮
    showLoading(true, pages);
    
    // 重置分页
    currentPage = 1;
    allVideos = [];
    currentCrawlPage = 1;
    totalCrawlPages = pages;
    
    // 调用后端API爬取视频数据
    fetch('/api/crawl', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ keyword: keyword.trim(), pages })
    })
    .then(response => response.json())
    .then(responseData => {
        if (responseData.status === 'error') {
            throw new Error(responseData.message || '爬取失败');
        }
        
        // 检查响应数据格式，如果包含status和data字段，则提取data部分
        if (responseData.status && responseData.task_id) {
            currentTaskId = responseData.task_id;
            
            // 开始进度轮询
            startProgressPolling();
            // 使用HTTP轮询获取结果
            checkTaskStatus();
        } else {
            // 兼容旧版API响应格式
            handleCrawlComplete(responseData.status && responseData.data ? responseData.data : responseData);
        }
    })
    .catch(error => {
        // 处理异常情况
        console.error('爬取失败:', error);
        showNotification(`爬取失败: ${error.message}`, 'error');
        showLoading(false);
    });
}

// 处理爬取完成的数据
function handleCrawlComplete(responseData) {
    // 过滤掉无效的视频数据
    const validVideos = responseData.filter(video => {
        return video && 
               video.pubdate !== 0 && 
               typeof video.pubdate === 'number' &&
               !isNaN(video.pubdate);
    });
    
    // 存储所有视频数据用于分页
    allVideos = validVideos;
    // 计算总页数
    totalPages = Math.ceil(allVideos.length / videosPerPage);
    currentPage = 1;
    
    // 处理数据并生成热度趋势图表
    processData(validVideos);
    
    // 显示当前页的爬取结果表格
    displayPagedResults();
    
    // 显示爬取结果统计摘要
    displaySummary(validVideos);
    
    // 更新分页控件
    updatePagination();
    
    // 显示成功通知
    showNotification(`爬取完成，共获取 ${validVideos.length} 个视频`, 'success');
    
    // 隐藏加载状态
    showLoading(false);
}

/**
 * 更新爬取进度显示
 * @param {number} current - 当前爬取的页码
 * @param {number} total - 总页数
 */
function updateCrawlProgress(current, total) {
    currentCrawlPage = current;
    totalCrawlPages = total;
    // 显示从第1页开始的进度
    domElements.currentPage.textContent = current + 1;
    domElements.totalPages.textContent = total;
}

/**
 * 模拟爬取进度更新
 * 根据爬虫实际行为调整进度速度
 */
// HTTP轮询相关变量
let progressPollingTimer = null;
let resultPollingTimer = null;

// 开始进度轮询
function startProgressPolling() {
    // 清除现有的定时器
    if (progressPollingTimer) {
        clearInterval(progressPollingTimer);
    }
    
    // 每1秒轮询一次进度
    progressPollingTimer = setInterval(() => {
        fetch(`/api/progress/${currentTaskId}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    updateCrawlProgress(data.data.current_page, data.data.total_pages);
                }
            })
            .catch(error => {
                console.error('获取进度失败:', error);
            });
    }, 1000);
}

// 检查任务状态
function checkTaskStatus() {
    // 清除现有的定时器
    if (resultPollingTimer) {
        clearInterval(resultPollingTimer);
    }
    
    // 每2秒检查一次任务状态
    resultPollingTimer = setInterval(() => {
        fetch(`/api/result/${currentTaskId}`)
            .then(response => {
                if (response.status === 200) {
                    return response.json();
                } else if (response.status === 400) {
                    // 任务仍在运行中，继续轮询
                    return null;
                } else {
                    throw new Error('获取结果失败');
                }
            })
            .then(data => {
                if (data) {
                    // 任务完成，处理结果
                    handleCrawlComplete(data.data);
                    stopAllPolling();
                }
            })
            .catch(error => {
                console.error('获取任务状态失败:', error);
                showNotification(`爬取失败: ${error.message}`, 'error');
                showLoading(false);
                stopAllPolling();
            });
    }, 2000);
}

// 停止所有轮询
function stopAllPolling() {
    if (progressPollingTimer) {
        clearInterval(progressPollingTimer);
        progressPollingTimer = null;
    }
    if (resultPollingTimer) {
        clearInterval(resultPollingTimer);
        resultPollingTimer = null;
    }
}

/**
 * 控制加载状态的显示与隐藏
 * @param {boolean} show - 是否显示加载状态
 * @param {number} pages - 爬取总页数（仅在显示加载状态时需要）
 */
function showLoading(show, pages = 0) {
    if (show) {
        // 显示加载动画
        domElements.loading.style.display = 'flex';
        // 禁用搜索按钮，防止重复点击
        domElements.searchBtn.disabled = true;
        domElements.searchBtn.textContent = '爬取中...';
        // 初始化爬取进度
        if (pages > 0) {
            updateCrawlProgress(0, pages);
        }
    } else {
        // 隐藏加载动画
        domElements.loading.style.display = 'none';
        // 启用搜索按钮
        domElements.searchBtn.disabled = false;
        domElements.searchBtn.textContent = '开始爬取';
        // 清除所有轮询定时器
        stopAllPolling();
        // 清除旧的进度定时器（兼容旧代码）
        if (progressTimer) {
            clearInterval(progressTimer);
            progressTimer = null;
        }
    }
}

/**
 * 处理爬取到的视频数据并生成热度趋势图表
 * @param {Array} data - 爬取到的视频数据数组
 */
function processData(data) {
    if (!data || data.length === 0) {
        generateEmptyChart();
        return;
    }
    
    // 按年份分组视频数据
    const dataByYear = new Map();
    
    // 遍历所有视频数据，按发布年份分组并预计算热度
    data.forEach(item => {
        try {
            // Bilibili API返回的是秒级时间戳，需要转换为毫秒级
            const timestamp = item.pubdate * 1000;
            
            // 获取视频发布年份
            const date = new Date(timestamp);
            
            // 检查时间戳是否有效
            if (!isNaN(date.getTime())) {
                // 获取发布年份
                const year = date.getFullYear();
                
                // 如果该年份不存在，则创建新对象
                if (!dataByYear.has(year)) {
                    dataByYear.set(year, {
                        videos: [],
                        totalHeat: 0
                    });
                }
                
                // 预计算热度值
                const heat = (item.play || 0) * 0.4 + 
                            (item.like || 0) * 0.2 + 
                            (item.coin || 0) * 0.2 + 
                            (item.favorite || 0) * 0.2;
                
                // 将视频数据和热度添加到对应年份
                const yearData = dataByYear.get(year);
                yearData.videos.push(item);
                yearData.totalHeat += heat;
            }
        } catch (error) {
            console.error('处理视频数据时出错:', error);
        }
    });
    
    // 计算每年的平均热度
    const years = Array.from(dataByYear.keys()).sort((a, b) => a - b); // 获取排序后的年份数组
    const heatData = []; // 存储每年的平均热度数据
    
    // 遍历每年的数据，计算平均热度
    years.forEach(year => {
        const yearData = dataByYear.get(year);
        // 计算该年份的平均热度
        const avgHeat = yearData.totalHeat / yearData.videos.length;
        heatData.push(avgHeat);
    });
    
    // 根据计算结果生成热度趋势图表
    generateChart(years, heatData);
}

/**
 * 生成热度趋势图表
 * @param {Array} years - 年份数组
 * @param {Array} heatData - 对应年份的平均热度数据数组
 */
function generateChart(years, heatData) {
    // 确保Chart.js加载完成后再操作图表
    if (typeof Chart === 'undefined') {
        console.error('Chart.js 未加载成功，无法生成图表');
        return;
    }
    
    // 获取canvas元素的绘图上下文
    const ctx = domElements.heatChart.getContext('2d');
    
    // 如果图表已存在，先销毁旧图表
    if (heatChart) {
        heatChart.destroy();
    }
    
    // 创建新的图表实例
    heatChart = new Chart(ctx, {
        type: 'line', // 图表类型：折线图
        data: {
            labels: years, // X轴标签：年份
            datasets: [{
                label: '平均热度', // 数据集名称
                data: heatData, // 数据集数据：平均热度
                backgroundColor: 'rgba(75, 192, 192, 0.2)', // 填充颜色
                borderColor: 'rgba(75, 192, 192, 1)', // 边框颜色
                borderWidth: 2, // 边框宽度
                tension: 0.3, // 线条平滑度
                fill: true, // 是否填充区域
                pointRadius: 4, // 数据点半径
                pointHoverRadius: 6 // 鼠标悬停时数据点半径
            }]
        },
        options: {
            responsive: true, // 响应式设计
            maintainAspectRatio: false, // 不保持宽高比
            interaction: {
                intersect: false, // 鼠标悬停时不要求精确相交
                mode: 'index' // 悬停时显示同一索引的所有数据
            },
            scales: {
                y: {
                    beginAtZero: true, // Y轴从0开始
                    title: {
                        display: true,
                        text: '平均热度' // Y轴标题
                    },
                    ticks: {
                        callback: function(value) {
                            return Math.round(value).toLocaleString(); // 格式化Y轴刻度
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '年份' // X轴标题
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        // 自定义提示框内容
                        label: function(context) {
                            return `平均热度: ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                },
                legend: {
                    display: true, // 显示图例
                    position: 'top' // 图例位置：顶部
                }
            }
        }
    });
}

/**
 * 更新分页控件状态
 */
function updatePagination() {
    // 更新页面信息显示
    domElements.currentPageDisplay.textContent = currentPage;
    domElements.totalPagesDisplay.textContent = totalPages;
    
    // 控制分页按钮状态
    domElements.prevBtn.disabled = currentPage === 1;
    domElements.nextBtn.disabled = currentPage === totalPages;
}

/**
 * 切换到上一页或下一页
 * @param {number} direction - 切换方向，1为下一页，-1为上一页
 */
function changePage(direction) {
    currentPage += direction;
    // 确保页码在有效范围内
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;
    
    // 显示当前页的结果
    displayPagedResults();
    // 更新分页控件
    updatePagination();
    // 更新摘要信息
    displaySummary(allVideos);
}

/**
 * 显示当前页的爬取结果表格
 */
function displayPagedResults() {
    if (allVideos.length === 0) {
        displayResults([]);
        return;
    }
    
    // 计算当前页显示的数据范围
    const startIndex = (currentPage - 1) * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    const currentPageVideos = allVideos.slice(startIndex, endIndex);
    
    // 显示当前页的结果
    displayResults(currentPageVideos, startIndex);
}

/**
 * 显示爬取结果的统计摘要
 * @param {Array} data - 爬取到的视频数据数组
 */
function displaySummary(data) {
    // 如果没有爬取到数据
    if (data.length === 0) {
        domElements.resultsSummary.innerHTML = '<p>未爬取到任何视频数据</p>';
        return;
    }
    
    // 计算各项统计指标
    const totalPlay = data.reduce((sum, item) => sum + item.play, 0); // 总播放量
    const totalLike = data.reduce((sum, item) => sum + item.like, 0); // 总点赞数
    const totalCoin = data.reduce((sum, item) => sum + item.coin, 0); // 总投币数
    const totalFavorite = data.reduce((sum, item) => sum + item.favorite, 0); // 总收藏数
    
    const avgPlay = totalPlay / data.length; // 平均播放量
    const avgLike = totalLike / data.length; // 平均点赞数
    const avgCoin = totalCoin / data.length; // 平均投币数
    const avgFavorite = totalFavorite / data.length; // 平均收藏数
    
    // 渲染统计摘要HTML
    domElements.resultsSummary.innerHTML = `
        <div class="summary-stats">
            <div class="stat-item">
                <span class="stat-label">爬取视频数:</span>
                <span class="stat-value">${data.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">总播放量:</span>
                <span class="stat-value">${formatNumber(totalPlay)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">平均播放量:</span>
                <span class="stat-value">${formatNumber(avgPlay)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">总点赞数:</span>
                <span class="stat-value">${formatNumber(totalLike)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">总投币数:</span>
                <span class="stat-value">${formatNumber(totalCoin)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">总收藏数:</span>
                <span class="stat-value">${formatNumber(totalFavorite)}</span>
            </div>
        </div>
    `;
}

/**
 * 显示爬取结果表格
 * @param {Array} data - 爬取到的视频数据数组
 * @param {number} startIndex - 起始索引，用于显示序号
 */
function displayResults(data, startIndex = 0) {
    // 清空表格内容
    domElements.resultsBody.innerHTML = '';
    
    // 如果没有爬取到数据
    if (data.length === 0) {
        domElements.resultsBody.innerHTML = '<tr><td colspan="9">未爬取到任何视频数据</td></tr>';
        return;
    }
    
    // 按发布时间排序，最新的在前
    data.sort((a, b) => b.pubdate - a.pubdate);
    
    // 创建文档片段，减少DOM操作
    const fragment = document.createDocumentFragment();
    
    // 遍历视频数据，添加表格行
    data.forEach((item, index) => {
        // 创建新行
        const row = document.createElement('tr');
        
        // 创建单元格
        const cells = [
            document.createElement('td'),
            document.createElement('td'),
            document.createElement('td'),
            document.createElement('td'),
            document.createElement('td'),
            document.createElement('td'),
            document.createElement('td'),
            document.createElement('td'),
            document.createElement('td')
        ];
        
        // 添加内容到单元格
        cells[0].textContent = startIndex + index + 1;
        cells[1].innerHTML = `<a href="https://www.bilibili.com/video/${item.bvid}" target="_blank">${item.title}</a>`;
        cells[2].textContent = formatDate(item.pubdate);
        cells[3].textContent = formatNumber(item.play);
        cells[4].textContent = formatNumber(item.like);
        cells[5].textContent = formatNumber(item.coin);
        cells[6].textContent = formatNumber(item.favorite);
        cells[7].textContent = item.up_name;
        cells[8].textContent = formatNumber(item.up_fans);
        
        // 将单元格添加到行
        cells.forEach(cell => row.appendChild(cell));
        
        // 将行添加到文档片段
        fragment.appendChild(row);
    });
    
    // 将文档片段添加到表格
    domElements.resultsBody.appendChild(fragment);
}

/**
 * 格式化数字，添加千位分隔符或转换为万为单位
 * @param {number} num - 要格式化的数字
 * @returns {string} 格式化后的数字字符串
 */
function formatNumber(num) {
    // 确保num是一个有效的数字
    num = Number(num);
    if (isNaN(num)) {
        return '0';
    }
    
    // 如果数字大于等于10000，转换为以万为单位
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + '万';
    }
    
    // 否则添加千位分隔符
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 显示通知消息
 * @param {string} message - 通知消息内容
 * @param {string} type - 通知类型 ('success'|'error'|'info')
 */
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加通知样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 4px;
        color: white;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        opacity: 0;
        transform: translateY(-20px);
        transition: opacity 0.3s ease, transform 0.3s ease;
    `;
    
    // 设置不同类型的背景色
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            notification.style.backgroundColor = '#f44336';
            break;
        case 'info':
            notification.style.backgroundColor = '#2196F3';
            break;
    }
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 显示通知
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    }, 100);
    
    // 自动隐藏通知
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        
        // 移除通知元素
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

/**
 * 生成空的热度趋势图表
 */
function generateEmptyChart() {
    // 确保Chart.js加载完成后再操作图表
    if (typeof Chart === 'undefined') {
        console.error('Chart.js 未加载成功，无法生成图表');
        return;
    }
    
    // 获取canvas元素的绘图上下文
    const ctx = document.getElementById('heatChart').getContext('2d');
    
    // 如果图表已存在，先销毁旧图表
    if (heatChart) {
        heatChart.destroy();
    }
    
    // 创建新的图表实例
    heatChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], // 空X轴标签
            datasets: [{
                label: '平均热度',
                data: [], // 空数据集
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '平均热度'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '年份'
                    }
                }
            },
            plugins: {
                tooltip: {
                    enabled: false // 禁用提示框
                },
                legend: {
                    display: true
                }
            }
        }
    });
}

/**
 * 格式化日期为YYYY-MM-DD格式
 * @param {Date|string|number} date - 要格式化的日期
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
    // Bilibili API返回的是秒级时间戳，需要转换为毫秒级
    const timestamp = date * 1000;
    // 确保date是一个有效的日期
    const d = new Date(timestamp);
    // 检查时间戳是否为0或无效
    if (isNaN(d.getTime()) || date === 0) {
        return '未知日期';
    }
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

/**
 * 页面加载完成后的初始化操作
 */
window.addEventListener('DOMContentLoaded', () => {
    // 确保Chart.js加载完成后再初始化图表
    if (typeof Chart !== 'undefined') {
        // 初始化空的热度趋势图表
        const ctx = document.getElementById('heatChart').getContext('2d');
        heatChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [], // 空X轴标签
                datasets: [{
                    label: '平均热度',
                    data: [], // 空数据集
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '平均热度'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '年份'
                        }
                    }
                }
            }
        });
    } else {
        console.error('Chart.js 未加载成功');
    }
});