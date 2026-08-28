# 木叶义齿设计平台 · 上线部署指南（PuTTY 版）

> 版本：V1.0 | 更新时间：2026-08-28
> 适用：Windows 用户，用 **PuTTY** 连接腾讯云 Ubuntu 服务器完成上线部署。
> 与《上线部署详细指南.md》内容一致，只是全程用 PuTTY 操作；清单版见《上线速查清单.md》。

---

## 第一部分：用 PuTTY 连上服务器（5 分钟）

### 1.1 下载并安装 PuTTY

1. 打开浏览器访问 PuTTY 官网：`https://www.putty.org`（或 GitHub：`https://github.com/r4digan/PuTTY` 里的安装包）。
2. 下载 **64 位 .msi 安装包**（如 `putty-64bit-installer.msi`），双击安装，一路「Next」即可。
3. 安装完成后在开始菜单找到 **PuTTY** 并打开。（建议右键「固定到任务栏」，以后常开。）

### 1.2 配置连接并把「会话」保存下来

打开 PuTTY 后，按以下填：

| 栏目 | 填写内容 |
|---|---|
| **Host Name** | 你的服务器公网 IP（腾讯云控制台 → 轻量服务器 → 你的实例 → 公网IP，如 `1.2.3.4`） |
| **Port** | `22` |
| **Connection type** | 选 **SSH** |

保存会话（以后双击就能连，不用每次填 IP）：
1. 左侧 **Session** 分类下，在 **Saved Sessions** 输入框写个名字，比如 `木叶服务器`。
2. 点右边 **Save**。
3. 以后打开 PuTTY，双击 `木叶服务器` 即自动连接。

> 腾讯云轻量服务器默认登录用户名是 **root**（Ubuntu 镜像）。

### 1.3 第一次连接：接受主机密钥指纹

1. 点 **Open**（或双击保存的会话）。
2. 第一次会出现一个告警框：*"The host key is not cached for this server..."*（服务器指纹确认）——腾讯云服务器首次连接属正常现象，点 **Accept（接受）** 即可。
3. 输入用户名 `root` 回车，再输入服务器密码（输入时**不显示任何字符**，属正常，输完直接回车）。
4. 看到类似 `root@VM-xxx:~#` 的提示符就说明连上了。

> 忘记密码：腾讯云控制台 → 轻量服务器 → 重置密码（重置后要重启实例生效）。

### 1.4 PuTTY 里的复制粘贴（重点，别跳过）

- **粘贴命令到 PuTTY**：先在 Windows 里复制（Ctrl+C），然后到 PuTTY 窗口**单击鼠标右键**即粘贴（或按 `Shift+Insert`）。
- **从 PuTTY 复制**：用鼠标**左键拖动选中**文字，选中即已复制到剪贴板。
- 多条命令：**整块一起粘贴即可**（PuTTY 会逐行执行，比一行行敲快且不易错）。
- 命令中途看走眼想重来：`Ctrl+C` 取消当前命令。
- 日志窗口太长：右键 → **清屏**（或 `Ctrl+L`，需配置）。
- 用完记得退出登录：输入 `exit` 或 `logout` 回车（关窗口也可以）。

### 1.5（可选）用密钥登录，不输密码更安全

1. 下载 **PuTTYgen**（同官网），选 RSA → Generate → 移动鼠标生成随机数 → Save private key（`.ppk` 保存到本地）。
2. 把公钥内容复制出来。
3. PuTTY 连上服务器后执行：
   ```bash
   mkdir -p ~/.ssh && chmod 700 ~/.ssh
   echo '粘贴你的公钥内容' >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```
4. PuTTY → Connection → SSH → **Auth → Credentials** 里选你的 `.ppk` 私钥文件 → 回 Session 保存。
5. 以后连接直接用密钥，不再输密码。

---

## 第二部分：从零部署（全程粘贴命令）

> 下面所有命令块都可以**整块复制 → 在 PuTTY 里右键粘贴**执行。
> 提示符 `#` 表示 root；命令执行完出现新提示符即成功。个别需要你改的地方用 `<尖括号>` 标了。

### 2.1 更新系统 + 装基础软件（nginx / sqlite3 / git / curl）

```bash
sudo apt update && sudo apt install -y nginx sqlite3 git curl
```

### 2.2 安装 Node 24（用 nvm）

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```
粘贴上面这行执行完后，**关掉 PuTTY 窗口重新连接一次**（或粘贴下面两行让环境立刻生效）：
```bash
export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```
然后：
```bash
nvm install 24
nvm alias default 24
node -v          # 应显示 v24.x
```

### 2.3 安装 pm2（进程守护，后端崩了自动拉起）

```bash
npm install -g pm2
```

### 2.4 拉取项目代码并构建

```bash
git clone https://github.com/Bugy959/muye-design-platform.git /var/www/muye
cd /var/www/muye/website
npm ci
npm run build
```
（`npm run build` 约几十秒到几分钟，看到 `✓ built` 即成功，产物在 `website/dist`。）
```bash
cd /var/www/muye/server
npm ci
```

### 2.5 配置后端环境变量（pm2 ecosystem）

```bash
nano /var/www/muye/server/ecosystem.config.js
```
（`nano` 是内置编辑器。把下面内容**整块粘贴**进去，把 `<你的...>` 改成真实值：）

```js
module.exports = {
  apps: [{
    name: 'muye-server',
    cwd: '/var/www/muye/server',
    script: 'src/index.js',
    instances: 1,
    max_memory_restart: '800M',
    env: {
      PORT: 3001,
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://<你的域名.com>',
      TRUST_PROXY: 1,
      COS_REGION: 'ap-shanghai',
      COS_BUCKET: '<muye-你的APPID>',
      COS_SECRET_ID: '<你的SecretId>',
      COS_SECRET_KEY: '<你的SecretKey>',
    },
  }],
}
```

nano 保存退出：按 `Ctrl+O` 回车保存 → `Ctrl+X` 退出。

启动后端并开机自启：
```bash
cd /var/www/muye/server
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```
（`pm2 startup` 会输出一行带 `sudo env ...` 的命令，**复制那行再粘回去执行**，实现开机自启。）

验证后端活着：
```bash
curl http://127.0.0.1:3001/api/health
# 预期：{"ok":true,"service":"muye-design-server","db":true,"cos":true,...}
```

### 2.6 配置 nginx

```bash
cat > /etc/nginx/sites-available/muye <<'EOF'
server {
    listen 80;
    server_name <你的域名.com>;

    root /var/www/muye/website/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```
> 上面 `<<'EOF' ... EOF` 是「把中间内容写入文件」的写法，整块粘贴即可。把 `<你的域名.com>` 换成真实域名。

启用并重载：
```bash
ln -s /etc/nginx/sites-available/muye /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```
（`nginx -t` 显示 `syntax is ok / test is successful` 才继续。）

### 2.7 免费 HTTPS（certbot 自动续期）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d <你的域名.com>
```
按提示：填邮箱、同意条款、选择「重定向 HTTP → HTTPS」（选 2）。完成后自动续期。

验证：`certbot renew --dry-run` 显示续期成功即可。

### 2.8 每日自动备份

```bash
mkdir -p /var/backups/muye
cat > /etc/cron.daily/muye-backup <<'EOF'
#!/bin/sh
sqlite3 /var/www/muye/server/data/muye.db "VACUUM INTO '/var/backups/muye/muye-$(date +%F).db'"
find /var/backups/muye -name 'muye-*.db' -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/muye-backup
```

---

## 第三部分：上线前安全与验收

### 3.1 必做安全项（PuTTY 里执行）

1. **改掉演示账号密码**（登录网页改，或删账号）：
   - admin / muye2026；mingzhou / hengmei / yahe / li... 都是 123456。
2. `CORS_ORIGIN` 已指向正式域名（2.5 已配）。
3. 防火墙：腾讯云控制台 → 轻量服务器 → 防火墙，只放行 **80 / 443**（22 保留给 SSH）。

### 3.2 上线验收（浏览器 + PuTTY）

在浏览器打开 `https://你的域名.com`，PuTTY 里配合验证：

```bash
curl https://你的域名.com/api/health
```

然后走一遍：
- [ ] 登录页正常、能登录
- [ ] 医院下单，**上传一个真实的扫描文件/照片**（看进度条、订单里文件大小正确）
- [ ] 设计师接单 → 交稿（上传设计文件）
- [ ] 医院下载设计文件成功
- [ ] 管理端点一遍（积分/分组/账号）
- [ ] 手机切 4G 再访问一次

---

## 第四部分：日常维护（PuTTY 常用命令）

```bash
# 更新版本（拉代码→重新构建→重启）
cd /var/www/muye
git pull
cd website && npm ci && npm run build
cd ../server && npm install
pm2 restart muye-server

# 看后端日志（Ctrl+C 退出查看）
pm2 logs muye-server

# 看 nginx 错误日志
tail -f /var/log/nginx/error.log

# 重启 nginx
systemctl reload nginx

# 看磁盘/内存（省得被塞满）
df -h
free -h
```

## 常见问题

**连不上 / Putty 报 Network error: Connection refused？**
安全组/防火墙没放行 22，或 IP 填错。腾讯云控制台防火墙确认开 22。

**Connection timed out？**
服务器可能关机，或公网 IP 变化（轻量服务器换 IP 后要改 PuTTY 会话里的 Host Name）。

**粘贴后命令没反应 / 只有半截？**
把命令整段都选中复制，再到 PuTTY 右键粘贴；如果光标在中间，先 `Ctrl+C` 清行再粘贴。

**提示 sudo 找不到命令？**
用 root 登录就不需要 sudo，直接执行即可（文档里命令都兼容两者）。

**页面打不开但 /api/health 通？**
多半是前端口径：确认 `website/.env.production` 存在且为 `VITE_API_BASE=/api`，重新 `npm run build` 后 `systemctl reload nginx`。