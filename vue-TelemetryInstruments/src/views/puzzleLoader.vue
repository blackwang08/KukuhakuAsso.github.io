<template>
  <article>
    <h1>{{ currentTitle }}</h1>

    <PuzzleNavigation :current-level="currentLevel" :max-level="maxUnlockedLevel" :visible="!gameCompleted"
      @navigate="goToLevel" />

    <div v-html="currentContent"></div>

    <div v-if="clueImageUrl && !gameCompleted" class="clue-display">
      <!-- 正常显示图片 -->
      <img v-if="!clueImageError" :src="clueImageUrl" alt="线索图片" style="max-width: 100%; border-radius: 8px;"
        @error="clueImageError = true" />

      <!-- 图片加载失败时的提示 -->
      <div v-else class="clue-error">
        <p>⚠️ 线索图片加载失败，可能因缓存失效或网络问题。</p>
        <div class="clue-error-actions">
          <button class="nav-btn" @click="retryLoadClue">🔄 重新加载</button>
          <button class="nav-btn" :disabled="currentLevel <= 1" @click="goToLevel(currentLevel - 1)">
            ← 回上一关重新获取
          </button>
        </div>
      </div>
    </div>

    <div v-if="!gameCompleted" style="margin-top: 2rem;">

      <input type="text" v-model.trim="answer" placeholder="输入答案" style="padding: 0.5rem; width: 260px;"
        @keyup.enter="handleSubmit" />
      <button @click="handleSubmit" :disabled="loading" style="padding: 0.5rem 1rem; margin-left: 0.5rem;">
        {{ loading ? '验证中...' : '提交' }}
      </button>
      <p :style="{ color: isSuccess ? 'green' : 'red', marginTop: '0.5rem' }">
        {{ result }}
      </p>
    </div>

    <div v-if="gameCompleted" class="ending">
      <img v-if="endingImageUrl" :src="endingImageUrl" alt="恭喜通关" style="max-width: 100%; border-radius: 8px;" />
      <p v-else class="loading-text">正在从本地保险箱加载大结局真相...</p>
    </div>
  </article>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { validateAndNormalize } from '../utils/verifierGuard.js'
import { startGame, fetchPuzzle, checkAnswer } from '../utils/authFetch.js'
import PuzzleNavigation from '@/components/puzzleNavigation.vue'

// 引入 IndexedDB 存储管理函数
import {
  getClueImageBlob,
  saveClueImageBlob,
  clearAllClueImages,
  getGameCompleted,
  getEndingImage,
  setGameCompleted
} from '../utils/storage.js'

const clueImageError = ref(false)

const route = useRoute()
const router = useRouter()

const props = defineProps({
  level: { type: [String, Number], required: true }
})

const currentLevel = computed(() => parseInt(props.level))

function goToLevel(level) {
  if (level < 1) return
  router.push(`/puzzle/${level}`)
}

const maxUnlockedLevel = ref(
  parseInt(localStorage.getItem('puzzle_max_unlocked')) || 1
)

// 更新并持久化最高解锁关卡
function updateMaxLevel(level) {
  if (level > maxUnlockedLevel.value) {
    maxUnlockedLevel.value = level
    localStorage.setItem('puzzle_max_unlocked', level)
  }
}

// ---------- 全局累积状态 ----------
const gameCompleted = ref(false)
const endingImageUrl = ref('')

// ---------- 当前关卡状态 ----------
const currentTitle = ref('加载中...')
const currentContent = ref('<p>正在获取关卡信息...</p>')
const answer = ref('')
const result = ref('')
const loading = ref(false)
const isSuccess = ref(false)

// 当前关卡对应的线索图片 URL
const clueImageUrl = ref('')
let currentObjectURL = null
let endingObjectURL = null // 单独管理结束图的内存释放

// ---------- 初始化与关卡切换 ----------
onMounted(async () => {
  const token = localStorage.getItem('game_token')
  if (!token) {
    await startGame()
  }

  // 恢复全局通关状态
  if (getGameCompleted()) {
    gameCompleted.value = true
    await loadEndingAssets()
    return
  }

  loadPuzzle(props.level)
  loadLocalClue(props.level)
})

watch(() => props.level, (newLevel) => {
  if (!gameCompleted.value) {
    loadPuzzle(newLevel)
    loadLocalClue(newLevel)
  }
})

// 组件销毁前释放 ObjectURL 内存
onBeforeUnmount(() => {
  revokeLocalObjectURL()
  if (endingObjectURL) URL.revokeObjectURL(endingObjectURL)
})

// 释放上一次生成的 ObjectURL
function revokeLocalObjectURL() {
  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL)
    currentObjectURL = null
  }
}

// ==========================================
// 加载通关结局图（支持本地 Blob 渲染）
// ==========================================
async function loadEndingAssets() {
  try {
    const cachedData = await getClueImageBlob('ending')
    if (cachedData && cachedData instanceof Blob) {
      if (endingObjectURL) URL.revokeObjectURL(endingObjectURL)
      endingObjectURL = URL.createObjectURL(cachedData)
      endingImageUrl.value = endingObjectURL
    } else {
      endingImageUrl.value = getEndingImage()
    }
  } catch (e) {
    endingImageUrl.value = getEndingImage()
  }
}

// ==========================================
// 加载当前关卡数据与图片
// ==========================================
async function loadPuzzle(level) {
  try {
    const data = await fetchPuzzle(level)
    currentTitle.value = data.title
    currentContent.value = data.content
    updateMaxLevel(level)
  } catch (e) {
    if (e.message === '无权限访问该关卡') {
      router.push('/puzzle/1')
    } else {
      currentTitle.value = '错误'
      currentContent.value = '<p>获取关卡数据失败，请刷新重试</p>'
    }
  }
}

async function loadLocalClue(level) {
  revokeLocalObjectURL()
  clueImageUrl.value = ''
  clueImageError.value = false

  try {
    const cachedData = await getClueImageBlob(level)
    if (cachedData) {
      if (cachedData instanceof Blob) {
        currentObjectURL = URL.createObjectURL(cachedData)
        clueImageUrl.value = currentObjectURL
      } else if (typeof cachedData === 'string') {
        clueImageUrl.value = cachedData
      }
    }
  } catch (error) {
    console.error('从 IndexedDB 读取缓存图片失败:', error)
  }
}

async function retryLoadClue() {
  clueImageError.value = false
  // 短暂延迟确保状态重置已应用，同时避免瞬间重复报错
  await nextTick()
  loadLocalClue(props.level)
}

async function cacheImageAndNavigate(url, backendHash, nextLevel) {
  try {
    const cachedData = await getClueImageBlob(nextLevel)
    const localHash = localStorage.getItem(`clue_hash_${nextLevel}`)

    // 如果 Blob 存在，并且 Hash 对得上，直接拦截
    if (cachedData && cachedData instanceof Blob && localHash === backendHash) {
      return
    }

    const response = await fetch(url)
    if (!response.ok) throw new Error('图片请求失败')
    const blob = await response.blob()


    //可选计算文件hash

    // 存储新 Blob，同步更新 Hash
    await saveClueImageBlob(nextLevel, blob)
    if (backendHash) localStorage.setItem(`clue_hash_${nextLevel}`, backendHash)
  } catch (error) {
    console.warn('图片转存失败，降级保存原 URL:', error)

    // 降级兜底：只有当前完全没存才存链接
    const currentCache = await getClueImageBlob(nextLevel)
    if (!currentCache) await saveClueImageBlob(nextLevel, url)

    // 清除 Hash 确保下次重新尝试下载
    localStorage.removeItem(`clue_hash_${nextLevel}`)
  } finally {
    router.push(`/puzzle/${nextLevel}`)
    result.value = ''
  }
}

// ==========================================
// 【核心修改 2】：缓存并做 Hash 校验 (通关大结局图)
// ==========================================
async function cacheEndingAssets(url, backendHash) {
  try {
    const cachedData = await getClueImageBlob('ending')
    const localHash = localStorage.getItem('clue_hash_ending')

    if (cachedData && cachedData instanceof Blob && localHash === backendHash) return

    const response = await fetch(url)
    if (response.ok) {
      const blob = await response.blob()
      await saveClueImageBlob('ending', blob)
      if (backendHash) localStorage.setItem('clue_hash_ending', backendHash)
    }
  } catch (e) {
    console.warn('缓存大结局图片失败:', e)
  }
}

// ==========================================
// 提交答案验证逻辑
// ==========================================
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

    result.value = data.message || (data.success ? '🎉 答案正确！正在加载...' : data.error || '答案错误，请再试试。')
    isSuccess.value = data.success

    if (data.success) {
      answer.value = ''
      const currentLevel = parseInt(props.level)

      //通关
      if (data.endingImageUrl) {
        result.value = '🎉 正在解锁最终真相...'

        await cacheEndingAssets(data.endingImageUrl, data.endingImageHash)

        setGameCompleted(data.endingImageUrl)
        gameCompleted.value = true

        // 载入大图用于展示（优先走本地 Blob）
        await loadEndingAssets()

        if (data.musicUrl) {
          const audio = new Audio(data.musicUrl)
          audio.volume = 0.8
          audio.play().catch(() => { console.log('浏览器阻止了自动播放') })
        }
      }
      else if (data.downloadUrl) {
        const nextLevel = currentLevel + 1
        updateMaxLevel(nextLevel)
        await cacheImageAndNavigate(data.downloadUrl, data.fileHash, nextLevel)
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
.clue-error {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem;
  margin-top: 0.5rem;
  text-align: center;
  color: var(--text);
}

.clue-error p {
  margin: 0 0 0.75rem;
}

.clue-error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.clue-error .nav-btn {
  padding: 6px 14px;
  border: 1px solid var(--border);
  background: var(--social-bg);
  color: var(--text-h);
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.25s;
  font-family: var(--sans);
}
</style>
