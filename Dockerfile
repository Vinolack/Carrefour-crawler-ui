# 使用轻量级 Node.js 镜像
FROM node:18-slim

# 设置工作目录
WORKDIR /app

# 优先复制依赖定义文件 (利用 Docker 缓存层)
COPY package.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建上传目录（防止权限问题）
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]