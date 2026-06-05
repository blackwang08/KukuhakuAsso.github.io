<template>
  <article>
    <h1>{{ currentTitle }}</h1>
    <div v-html="currentContent"></div>

    <!-- 从上一关带过来的线索图片（自动展示，无按钮） -->
    <div v-if="clueImageUrl" class="clue-display">
      <h3>🎁 新线索</h3>
      <img :src="clueImageUrl" alt="线索图片" style="max-width: 100%; border-radius: 8px;" />
    </div>

    <div style="margin-top: 2rem;">
      <input type="text" v-model.trim="answer" placeholder="输入答案" style="padding: 0.5rem; width: 260px;"
        @keyup.enter="handleSubmit" />
      <button @click="handleSubmit" :disabled="loading" style="padding: 0.5rem 1rem; margin-left: 0.5rem;">
        {{ loading ? '验证中...' : '提交' }}
      </button>
      <p :style="{ color: isSuccess ? 'green' : 'red', marginTop: '0.5rem' }">
        {{ result }}
      </p>
    </div>

    <!-- 通关后的永久展示（仅用于第7关） -->
    <div v-if="endingImageUrl && gameCompleted" class="ending">
      <img :src="endingImageUrl" alt="恭喜通关" style="max-width: 100%; border-radius: 8px;" />
    </div>
  </article>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { validateAndNormalize } from '../utils/verifierGuard.js'
import { startGame, fetchPuzzle, checkAnswer } from '../utils/authFetch.js'

const route = useRoute()
const router = useRouter()

const props = defineProps({
  level: { type: [String, Number], required: true }
})

// ---------- 全局累积状态 ----------
const collectedClues = ref([])      // 收集所有线索 URL（非必须，仅记录）
const gameCompleted = ref(false)
const endingImageUrl = ref('')

// ---------- 当前关卡状态 ----------
const currentTitle = ref('加载中...')
const currentContent = ref('<p>正在获取关卡信息...</p>')
const answer = ref('')
const result = ref('')
const loading = ref(false)
const isSuccess = ref(false)

// 从路由 query 获取的线索图片（由上一关传递）
const clueImageUrl = ref('')

// ---------- 初始化与关卡切换 ----------
onMounted(async () => {
  // 如果没有 token，先开始新游戏
  const token = localStorage.getItem('game_token')
  if (!token) {
    await startGame()
  }
  // 读取可能的线索参数
  updateClueFromRoute()
  loadPuzzle(props.level)
})

watch(() => props.level, (newLevel) => {
  updateClueFromRoute()
  loadPuzzle(newLevel)
})

// 监听路由 query 变化（例如从 /puzzle/2?clue=xxx 进入时）
watch(() => route.query.clue, (newClue) => {
  if (newClue) {
    clueImageUrl.value = newClue
  }
})

function updateClueFromRoute() {
  const clue = route.query.clue
  clueImageUrl.value = clue || ''
}

// 加载关卡数据（标题、描述）
async function loadPuzzle(level) {
  try {
    const data = await fetchPuzzle(level)
    currentTitle.value = data.title
    currentContent.value = data.content
  } catch (e) {
    if (e.message === '无权限访问该关卡') {
      router.push('/puzzle/1')
    } else {
      currentTitle.value = '错误'
      currentContent.value = '<p>获取关卡数据失败，请刷新重试</p>'
    }
  }
}

// ---------- 答案提交 ----------
async function handleSubmit() {
  const raw = validateAndNormalize(answer.value)
  if (!raw.valid) {
    result.value = raw.error
    return
  }
  const userAnswer = raw.normalized || answer.value.trim()
  if (!userAnswer) {
    result.value = '请输入答案'
    return
  }

  loading.value = true
  result.value = ''
  isSuccess.value = false

  try {
    const data = await checkAnswer(parseInt(props.level), userAnswer)

    result.value = data.message || (data.success ? '🎉 答案正确！' : data.error||'答案错误，请再试试。')
    isSuccess.value = data.success

    if (data.success) {
      answer.value = ''
      const currentLevel = parseInt(props.level)
      if (data.endingImageUrl) {
        // 通关（第7关）
        endingImageUrl.value = data.endingImageUrl
        gameCompleted.value = true
        // 播放音乐（如果有）
        if (data.musicUrl) {
          const audio = new Audio(data.musicUrl)
          audio.volume = 0.8
          audio.play().catch(() => { })
        }
      } else if (data.downloadUrl) {
        // 获得新线索，记录到 collectedClues（可选）
        collectedClues.value.push(data.downloadUrl)
        // 自动跳转到下一关，并携带线索图片
        const nextLevel = currentLevel + 1
        router.push({
          path: `/puzzle/${nextLevel}`,
          query: { clue: data.downloadUrl }
        })
      }
    }
  } catch (error) {
    console.error(error)
    result.value = '网络错误，请检查网络后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.ending {
  margin-top: 30px;
  animation: fadeIn 1s ease;
}

.clue-display {
  margin-top: 20px;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
  animation: fadeIn 0.5s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
