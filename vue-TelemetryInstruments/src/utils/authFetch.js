const apiBase = import.meta.env.VITE_API_BASE || '';

// 获取存储的 token
function getToken() {
    return localStorage.getItem("game_token");
}

export class TokenExpiredError extends Error {
    constructor(message = "游戏凭证已过期") {
        super(message);
        this.name = "TokenExpiredError";
    }
}

// 改造后的 authFetch
export async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = {
        ...options.headers,
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
    };
    const res = await fetch(`${apiBase}${url}`, { ...options, headers });

    if (res.status === 401) {
        throw new TokenExpiredError();
    }

    return res;
}


// 开始新游戏
export async function startGame() {

    const res = await fetch(`${apiBase}/api/game/start`, { method: "POST" });
    const data = await res.json();
    if (data.token) {
        localStorage.setItem("game_token", data.token);
    }
    return data;
}

// 获取关卡数据
export async function fetchPuzzle(level) {
    const res = await authFetch(`/api/puzzle/${level}`);
    if (res.status === 403) {
        throw new Error("无权限访问该关卡");
    }
    return res.json();
}

// 重新获取关卡数据
export async function refetchPuzzle(level) {
    const res = await authFetch(`/api/puzzle/${level}`, { method: "POST" });
    if (res.status === 403) {
        throw new Error("无权限访问该关卡");
    }
    return res.json();
}

// 重新获取结局资源
export async function fetchEndingAssets() {
    const res = await authFetch("/api/ending/assets");

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "获取结局资源失败");
    }
    return res.json();
}

// 提交答案
export async function checkAnswer(level, answer) {
    const res = await authFetch("/api/check", {
        method: "POST",
        body: JSON.stringify({ level, answer }),
    });
    const data = await res.json();
    if (data.success && data.token) {
        localStorage.setItem("game_token", data.token);
    }
    return data;
}


export async function uploadInfo(info) {
    const res = await authFetch("/api/game/finished", {
        method: "POST",
        body: JSON.stringify(info),
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "提交信息失败");
    }

    return res.json();
}
