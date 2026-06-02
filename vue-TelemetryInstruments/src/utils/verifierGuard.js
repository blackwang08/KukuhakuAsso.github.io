// --- 安全配置 ---
const MAX_ANSWER_LENGTH = 200; // 防止超长字符串攻击

// 可选：字符白名单校验（拒绝明显恶意的特殊字符）
function isAnswerSafe(str) {
    // 允许字母、数字、空格、常见标点（可按需增减）
    return /^[\w\s.,!?\-+*/@#$%^&()\[\]{}|~`'"<>:;]+$/.test(str);
}

// --- 在 checkAnswer 中的使用模式 ---
async function checkAnswer(mode = "loose") {
    const raw = answer.value;
    if (!raw) {
        result.value = "请输入答案";
        return;
    }

    // 1. 防注入：长度限制
    if (raw.length > MAX_ANSWER_LENGTH) {
        result.value = "答案过长，请检查";
        return;
    }

    // 2. 防注入：字符白名单检查（可选，若启用则阻止高危字符）
    if (!isAnswerSafe(raw)) {
        result.value = "答案包含非法字符";
        return;
    }

    // 3. 根据模式规范化
    let normalized = "";
    if (mode === "strict") {
        normalized = normalizeAnswerStrict(raw);
    } else {
        normalized = normalizeAnswerLoose(raw);
    }

    if (!normalized) {
        result.value = "答案无效，请重新输入";
        return;
    }

    if (loading.value) return;
    loading.value = true;
    result.value = "";

    try {
        // 4. 关键：用 encodeURIComponent 包装，避免破坏 URL 结构
        const url = `${apiUrl}?level=${encodeURIComponent(props.level)}&answer=${encodeURIComponent(normalized)}`;
        const response = await fetchWithTimeout(
            url,
            { redirect: "follow" },
            15000,
        );

        if (response.status === 403) {
            result.value = "答案错误，请再试试";
        } else if (response.redirected) {
            // 5. 跳转安全：只信任服务端返回的 URL（需确保后端本身无开放重定向漏洞）
            window.location.href = response.url;
        } else {
            result.value = "发生未知错误，请稍后重试";
        }
    } catch (err) {
        result.value =
            err.name === "AbortError"
                ? "请求超时，请重试"
                : "网络错误，请检查网络后重试";
    } finally {
        loading.value = false;
    }
}
