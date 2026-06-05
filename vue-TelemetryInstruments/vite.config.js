import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
    base: "/vue-telemetry/",
    server: {
        proxy: {
            // 将以 /api-base 开头的请求代理到云函数
            "/api-base": {
                target: "https://1438673597-gggz8ep6r6.ap-shanghai.tencentscf.com",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api-base/, ""), // 去掉 /api-base 前缀
            },
        },
        port: 5175, // 固定端口，避免随机占用
    },
    plugins: [vue()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"), // 将 @ 映射到 src 目录
        },
    },
    build: {
        outDir: "./output",
        emptyOutDir: true,
    },
});
