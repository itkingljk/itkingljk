# 当前仓库部署说明

仓库：https://github.com/itkingljk/itkingljk

转换工具在 `png-to-jpg/` 目录中，仓库原来的 `README.md` 和 `index.md` 保留不变。网站无需构建、后端或数据库。

## 先使用 GitHub Pages

1. 打开 https://github.com/itkingljk/itkingljk/settings/pages
2. 在 Build and deployment 中，将 Source 设置为 **Deploy from a branch**。
3. Branch 选择 **main**，Folder 选择 **/(root)**，点击 Save。
4. 等待 Actions 中的 **pages build and deployment** 成功。
5. 在 Pages 设置里复制实际站点根地址，再在末尾追加 `png-to-jpg/`。

通常工具地址是 https://itkingljk.github.io/itkingljk/png-to-jpg/ 。这是预期地址，只有 Pages 发布成功后才有效。若设置页返回的根地址不同，以设置页为准。

不要选择 `/docs`，也不需要选择 GitHub Actions 自定义工作流。本仓库采用分支发布；提交 main 后由 Pages 自动构建，并保留原有 Markdown 主页的处理。

在任意设备上均可通过最终 HTTPS 地址使用，无需先购买服务器、公网 IP 或域名。图片仅在各访问者自己的浏览器处理，历史文件信息也保存在各自浏览器，不会上传至 GitHub。

## 部署到 Ubuntu 24.04

在云服务商控制台先给服务器分配/绑定公网 IPv4（部分服务商称 EIP），并在安全组放行 TCP 80、443。绑定公网 IP 是云资源操作，无法仅通过修改网页完成。

通过服务器已有的 SSH 登录方式执行：

```sh
sudo apt update
sudo apt install -y nginx git
sudo systemctl enable --now nginx
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/itkingljk/itkingljk.git
cd itkingljk
sudo install -d -m 755 /var/www/qingzhuan
sudo install -m 644 png-to-jpg/index.html png-to-jpg/style.css png-to-jpg/app.js /var/www/qingzhuan/
sudo cp png-to-jpg/deploy/nginx.conf /etc/nginx/sites-available/qingzhuan
sudo nano /etc/nginx/sites-available/qingzhuan
```

将配置中的 `server_name SERVER_PUBLIC_IP convert.example.com;` 替换为 `server_name 你的实际公网IP;`；这里的中文必须替换成真实数字 IP。如果之后绑定域名，将域名也加入 server_name。

首次安装启用配置：

```sh
sudo ln -s /etc/nginx/sites-available/qingzhuan /etc/nginx/sites-enabled/qingzhuan
sudo nginx -t
```

只有检查成功后执行：

```sh
sudo systemctl reload nginx
```

如果主机防火墙 UFW 已启用，也需要允许 80/443：

```sh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

无需暴露开发端口 8765，不要关闭整个防火墙。现在可通过 `http://你的公网IP/` 验证页面。

已有其他网站时，先检查站点名称、根目录和已有配置，保留其他站点；链接已存在时跳过 ln 步骤。

## 域名和 HTTPS

没有域名时可先用公网 IP 验证。之后购买/使用自己的域名，在 DNS 添加 A 记录指向公网 IP；Nginx 的 server_name 加入该真实域名。确认 HTTP 可访问后，按照 Certbot 官方步骤开启 HTTPS：

https://certbot.eff.org/instructions?os=snap&ws=nginx

全新 Ubuntu 使用 Snap 的命令示例（已有其他版本 Certbot 时先按官方文档处理，避免混装）：

```sh
sudo apt install -y snapd
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx -d 你的实际域名
sudo /snap/bin/certbot renew --dry-run
```

申请前需完成域名解析，公网 80/443 端口可访问。完成后把 `https://你的实际域名/` 发给别人。无需修改转换工具代码中的 IP，代码没有写死服务器地址。

## 更新服务器

推送项目代码到 main 后，在服务器执行：

```sh
cd ~/apps/itkingljk
git pull --ff-only
sudo install -m 644 png-to-jpg/index.html png-to-jpg/style.css png-to-jpg/app.js /var/www/qingzhuan/
```

静态文件更新无需重启应用。

## 验证与数据行为

- 单张和批量 PNG 转 JPG、单张下载、ZIP 下载。
- 透明区域填白，保留原图像素尺寸，可调整 JPG 画质。
- 原始图片不会上传，转换完成后释放；输出仅保存在当前页面内存。
- 清空列表、刷新或关闭页面后释放输出。已下载到设备的文件由访问者管理。
- 最近 200 条历史只保留文件名、大小、时间和状态，保存在访问者浏览器，可搜索及清空。
- 换设备、域名或 HTTP/HTTPS 时，本地历史不会同步。

## 参考

GitHub Pages 分支发布：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
Ubuntu Nginx：https://ubuntu.com/server/docs/how-to/web-services/install-nginx/
Nginx 静态网站：https://nginx.org/en/docs/beginners_guide.html
