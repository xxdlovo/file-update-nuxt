# 使用 Node.js 基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制构建产物
COPY .output .output

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", ".output/server/index.mjs"]