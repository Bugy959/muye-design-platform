import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          ui: ['lucide-react', 'recharts', 'sonner', 'cmdk', 'date-fns'],
        },
      },
    },
  },
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
    host: true, // 绑定 0.0.0.0，允许局域网其它设备访问（http://<本机IP>:3000）
  },
  preview: {
    host: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
