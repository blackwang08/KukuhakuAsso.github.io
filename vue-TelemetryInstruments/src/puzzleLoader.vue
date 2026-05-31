<template>
    <article>
        <h1>{{ title }}</h1>
        <div v-html="content"></div>

        <div style="margin-top: 2rem;">
            <input type="text" v-model.trim="answer" placeholder="输入答案" style="padding: 0.5rem; width: 200px;" />
            <button @click="checkAnswer" :disabled="loading" style="padding: 0.5rem 1rem;">
                {{ loading ? '验证中...' : '提交' }}
            </button>
            <p v-if="result" style="color: red; margin-top: 0.5rem;">
                {{ result }}
            </p>
        </div>
    </article>
</template>

<script setup>
import { ref } from 'vue'
import { useAnswerNormalizer } from '@/utils/answerNormalizer'

// 接收父组件传入的谜题数据（对应 Jekyll 的 front matter 和内容）
const props = defineProps({
    title: { type: String, required: true },
    content: { type: String, required: true },  // HTML 字符串
    level: { type: [String, Number], required: true }
})

const answer = ref('')
const result = ref('')
const loading = ref(false)
// 使用 composable，默认宽松模式，也可以传入 'strict'
const { mode, setMode, normalize } = useAnswerNormalizer('loose')

// 替换为你实际的云函数触发地址
const apiUrl = 'https://your-cloud-function-url.com/verify'

async function checkAnswer() {
    const raw = answer.value
    if (!raw) {
        result.value = '请输入答案'
        return
    }

    // 规范化
    const normalized = normalize(raw)
    if (!normalized) {
        result.value = '答案无效，请重新输入'
        return
    }

    if (loading.value) return
    loading.value = true
    result.value = ''

    try {
        const url = `${apiUrl}?level=${encodeURIComponent(props.level)}&answer=${encodeURIComponent(normalized)}`
        const response = await fetch(url, { redirect: 'follow' })
        // ... 处理响应逻辑
        if (response.status === 403) {
            result.value = '答案错误，请再试试'
        } else if (response.redirected) {
            window.location.href = response.url
        } else {
            result.value = '发生未知错误，请稍后重试'
        }
    } catch {
        result.value = '网络错误，请检查网络后重试'
    } finally {
        loading.value = false
    }
}

</script>
