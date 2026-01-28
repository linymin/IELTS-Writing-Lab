# 私有化部署指南 (Tencent Cloud / Ubuntu 22.04)

本指南介绍如何在腾讯云 Ubuntu 22.04 服务器上进行私有化部署。

## 1. 服务器环境准备

登录到您的服务器，更新系统并安装 Docker 和 Docker Compose。

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# 安装 Docker Compose (Docker v2 已经包含 compose 插件，但为了兼容性可以使用以下命令)
sudo apt install -y docker-compose-plugin

# 验证安装
sudo docker --version
sudo docker compose version
```

## 2. 部署代码

### 2.1 上传代码
将项目代码上传到服务器（可以使用 git clone 或 scp）。

### 2.2 配置环境变量
在项目根目录创建 `.env` 文件。您可以复制示例文件进行修改：

```bash
cp .env.example .env
nano .env
```

**关键配置说明：**
- `NEXT_PUBLIC_SITE_URL`: 设置为您的服务器 IP 或域名（例如 `http://1.2.3.4:3000` 或 `https://your-domain.com`）。
- `NEXT_PUBLIC_SUPABASE_URL` / `KEY`: 您的 Supabase 项目配置。
- `DOUBAO_API_KEY`: 豆包大模型 API Key。

### 2.3 启动服务
使用 Docker Compose 构建并启动服务：

```bash
# 构建并后台启动
sudo docker compose up -d --build
```

应用将在 `3000` 端口运行。

## 3. 运维与更新

### 查看日志
```bash
sudo docker compose logs -f
```

### 更新代码
```bash
# 拉取新代码 (如果是 git 管理)
git pull

# 重建并重启
sudo docker compose up -d --build
```

### 停止服务
```bash
sudo docker compose down
```

## 4. 常见问题

- **构建失败**：请确保 `.env` 文件中包含了所有 `NEXT_PUBLIC_` 开头的变量，因为 Next.js 在构建时需要这些变量（虽然我们已经配置了 Dockerfile 读取 args，但最佳实践是保持 .env 文件完整）。
- **端口冲突**：如果 3000 端口被占用，请修改 `docker-compose.yml` 中的 `ports` 映射，例如 `"80:3000"` 将容器的 3000 映射到宿主机的 80。
