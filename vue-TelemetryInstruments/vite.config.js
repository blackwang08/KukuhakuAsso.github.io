import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
    base: "/TelemetryInstruments/",
    server: {
        proxy: {
            "/api-base": {
                target: "https://1438673597-hl571gnj2q.ap-shanghai.tencentscf.com",
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
