// 部署用 pm2 配置示例：复制为 ecosystem.config.js 后填入真实密钥即可
//   cd /var/www/muye/server
//   cp ecosystem.config.example.js ecosystem.config.js
//   nano ecosystem.config.js     # 修改 COS_* 等（见《上线部署指南-PuTTY版.md》2.5）
//   pm2 start ecosystem.config.js && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: 'muye-server',
      cwd: '/var/www/muye/server',
      script: 'src/index.js',
      instances: 1,
      max_memory_restart: '800M',
      env: {
        PORT: 3001,
        NODE_ENV: 'production',
        // 跨域白名单（生产必设，与前端域名一致；nginx 同源反代其实不跨域，此为防御性设置）
        CORS_ORIGIN: 'https://你的域名.com',
        // nginx 反代一层：登录限流按客户端真实 IP 计数
        TRUST_PROXY: 1,
        // —— 腾讯云 COS（大文件直传/下载；桶名必须是 名字-1250000000 格式）——
        COS_REGION: 'ap-shanghai',
        COS_BUCKET: '你的桶名-1250000000',
        COS_SECRET_ID: '你的SecretId',
        COS_SECRET_KEY: '你的SecretKey',
        // 可选：孤儿上传回收是否顺带删除 COS 对象（建议桶生命周期规则，保持默认关闭即可）
        // COS_ENABLE_CLEANUP: 'true',
      },
    },
  ],
}