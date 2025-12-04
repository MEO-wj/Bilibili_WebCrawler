# 使用包含Node.js和Python的基础镜像
FROM nikolaik/python-nodejs:python3.11-nodejs20

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 安装Python依赖
RUN pip install -r requirements.txt

# 安装Node.js依赖
RUN npm install

# 暴露端口
EXPOSE 3000
EXPOSE 5000

# 启动命令，同时运行两个服务
CMD python crawler_api.py & node server.js
