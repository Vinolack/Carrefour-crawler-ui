### 构建镜像
```
# 进入 carrefour-ui 目录
cd carrefour-ui
docker build -t carrefour-ui .
```

### 启动容器
```
docker run -d \
  -p 3000:3000 \
  -e PYTHON_API_URL=http://192.168.1.100:8000 \  #替换后端地址
  --name carrefour-ui \
  carrefour-ui
```