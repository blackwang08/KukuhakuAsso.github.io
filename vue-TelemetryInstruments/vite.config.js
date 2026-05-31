import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue()],
    build: {
        // 输出到 Jekyll 的 assets/vue-telemetry 下
        outDir: "../assets/vue-telemetry",
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
