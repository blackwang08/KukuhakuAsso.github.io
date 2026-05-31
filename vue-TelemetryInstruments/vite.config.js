import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"), // 关键：将 @ 映射到 src 目录
        },
    },
    build: {
        // 输出到 Jekyll 的 assets/vue-telemetry 下
        outDir: "../assets/vue-app",
        emptyOutDir: true,
        rollupOptions: {
            output: {
                // 固定文件名，不产生哈希
                entryFileNames: "js/[name].js",
                chunkFileNames: "js/[name].js",
                assetFileNames: "[ext]/[name].[ext]",
            },
        },
    },
});
