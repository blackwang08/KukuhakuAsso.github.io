// scripts/dev-all.js
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

// 🎯 同样读取 JSON 配置表
const projectTable = JSON.parse(
    fs.readFileSync(path.resolve(ROOT_DIR, "projects.json"), "utf-8"),
);

console.log("🚀 正在并发启动所有项目的开发服务器...\n");

const runningProcesses = [];

// 1. 启动 VitePress 博客
const docsServer = spawn("npx", ["vitepress", "dev", "docs"], {
    cwd: ROOT_DIR,
    shell: true,
    stdio: "inherit",
});
runningProcesses.push(docsServer);

// 2. 自动遍历 JSON 表，启动所有子项目
for (const project of projectTable) {
    console.log(
        `🔗 正在拉起子项目开发服务器: ${project.name} (端口预测: ${project.devPort})`,
    );
    const subServer = spawn("npm", ["run", "dev"], {
        cwd: path.resolve(ROOT_DIR, project.dir),
        shell: true,
        stdio: "inherit",
    });
    runningProcesses.push(subServer);
}

// 统一关闭管理
const killAll = () => {
    console.log("\n🛑 正在关闭所有开发服务器...");
    runningProcesses.forEach((proc) => proc.kill());
    process.exit();
};

process.on("SIGINT", killAll);
process.on("SIGTERM", killAll);
