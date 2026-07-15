<template>
  <article>
    <h1>{{ currentTitle }}</h1>

    <PuzzleNavigation :current-level="currentLevel" :max-level="maxUnlockedLevel" :visible="!gameCompleted"
                      @navigate="goToLevel"/>

    <div v-html="currentContent"></div>

    <!-- 线索图片展示与加载异常处理 -->
    <div v-if="clueImageUrl && !gameCompleted" class="clue-display">
      <img v-if="!clueImageError" :src="clueImageUrl" alt="线索图片" style="max-width: 100%; border-radius: 8px;"
           @error="clueImageError = true"/>
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

    <!-- 答案输入区域 -->
    <div v-if="!gameCompleted" style="margin-top: 2rem;">
      <input type="text" v-model.trim="answer" placeholder="输入答案" style="padding: 0.5rem; width: 260px;"
             @keyup.enter="handleSubmit"/>
      <button @click="handleSubmit" :disabled="loading" style="padding: 0.5rem 1rem; margin-left: 0.5rem;">
        {{ loading ? '验证中...' : '提交' }}
      </button>
      <p :style="{ color: isSuccess ? 'green' : 'red', marginTop: '0.5rem' }">
        {{ result }}
      </p>
    </div>

    <!-- 通关结局界面 -->
    <div v-if="gameCompleted" class="ending">
      <!-- 图片正常加载且未超时 -->
      <img v-if="endingImageUrl && !endingImageError" :src="endingImageUrl" alt="恭喜通关"
           style="max-width: 100%; border-radius: 8px;" @load="onEndingImageLoad" @error="onEndingImageError"/>
      <!-- 图片加载中（URL 已有，但图片还没 load） -->
      <p v-else-if="endingImageUrl && !endingImageError && !endingImageTimeout" class="loading-text">
        正在加载结局图片...
      </p>
      <!-- 超时或异常提示 -->
      <p v-if="endingImageError || endingImageTimeout" class="timeout-text">
        ⚠️ 结局图片加载失败或超时，请尝试重置游戏。
      </p>
      <!-- 根本没有任何图片 URL 且未超时（仍在异步获取中） -->
      <p v-else-if="!endingImageUrl && !endingAssetTimeout" class="loading-text">
        正在准备结局资源...
      </p>
      <!-- 资源获取总超时 -->
      <p v-if="endingAssetTimeout && !endingImageError && !endingImageTimeout" class="timeout-text">
        结局资源获取超时，请重置游戏重试。
      </p>
      <div v-if="rewardCheck" style="margin-top: 1.5rem;">
        <button v-if="!infoSubmitted" class="submit-info-btn" @click="showInfoModal = true">
          🎁 填写领奖信息
        </button>
        <div v-else>
          <p style="color: green; margin: 0.5rem 0;">✅ 信息已提交</p>
          <button class="submit-info-btn" @click="showInfoModal = true">🔄 重新提交</button>
        </div>
      </div>
    </div>
    <resetButton :game-completed="gameCompleted" :visible="gameCompleted" @reset="resetGame"/>
    <InfoUploadModal v-model:visible="showInfoModal" @submitted="infoSubmitted = true"/>
  </article>
</template>

<script setup>
import {inject, ref, onMounted, watch, onBeforeUnmount, computed, nextTick} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {validateAndNormalize} from '../utils/verifierGuard.js'
import {
  startGame,
  fetchPuzzle,
  refetchPuzzle,
  checkAnswer,
  fetchEndingAssets,
  TokenExpiredError
} from '../utils/authFetch.js'
import PuzzleNavigation from '@/components/puzzleNavigation.vue'
import resetButton from '@/components/reset.vue'
import InfoUploadModal from '@/components/upload.vue'
import {
  getClueImageBlob,
  saveClueImageBlob,
  getGameCompleted,
  getEndingImage,
  setGameCompleted
} from '../utils/storage.js'

const route = useRoute()
const router = useRouter()
const props = defineProps({level: {type: [String, Number], required: true}})
const currentLevel = computed(() => parseInt(props.level))

// ==================== 全局累积状态 ====================
const gameCompleted = ref(false)
const endingImageUrl = ref('')
const maxUnlockedLevel = ref(
    parseInt(localStorage.getItem('puzzle_max_unlocked')) || 0
)
const rewardCheck = ref(false)
const showInfoModal = ref(false)
const infoSubmitted = ref(localStorage.getItem('puzzle_info_submitted') === 'true')
let isRestartingAfterExpiry = false;

// ==================== 当前关卡状态 ====================
const currentTitle = ref('加载中...')
const currentContent = ref('<p>正在获取关卡信息...</p>')
const answer = ref('')
const result = ref('')
const loading = ref(false)
const isSuccess = ref(false)

// 当前关卡对应的线索图片 URL（Blob 或远程地址）
const clueImageUrl = ref('')
const clueImageError = ref(false)

// 内存中的 ObjectURL，用于手动释放
let currentObjectURL = null
let endingObjectURL = null

// ==================== 结局状态 ====================
// 结局图片加载状态
const endingImageError = ref(false)      // img 的 error 事件触发
const endingImageTimeout = ref(false)    // img 加载超时（src 存在但未 load）
let endingImgTimer = null                // 超时定时器

// 结局资源整体获取超时（URL 始终为空时）
const endingAssetTimeout = ref(false)
let endingAssetTimer = null


// ==================== 工具函数 ====================
function onEndingImageLoad() {
  clearEndingImgTimer()
}

function onEndingImageError() {
  clearEndingImgTimer()
  endingImageError.value = true
}

function clearEndingImgTimer() {
  if (endingImgTimer) {
    clearTimeout(endingImgTimer)
    endingImgTimer = null
  }
}

// 注入的背景音乐切换方法
const changeBgm = inject('changeBgm', null)
const playDefault = inject('playDefault', null)
// 请求序号，用于避免并发切换时旧请求覆盖新的缓存
let bgmRequestCounter = 0
let currentBgmRequestId = 0

function resetGame() {
  if (confirm('确定要重置游戏吗？这将清除所有进度和缓存。')) {
    const token = localStorage.getItem('game_token');
    localStorage.clear();
    if (token) {
      localStorage.setItem('game_token', token);
    }
    indexedDB.deleteDatabase('GameImageDB')

    gameCompleted.value = false
    endingImageUrl.value = ''
    endingImageError.value = false
    endingImageTimeout.value = false
    endingAssetTimeout.value = false
    maxUnlockedLevel.value = 0
    rewardCheck.value = false
    infoSubmitted.value = false

    // 清除结局相关的 ObjectURL
    if (endingObjectURL) {
      URL.revokeObjectURL(endingObjectURL)
      endingObjectURL = null
    }
    clearEndingImgTimer()
    if (endingAssetTimer) {
      clearTimeout(endingAssetTimer)
      endingAssetTimer = null
    }

    // 清除当前关卡的图片 ObjectURL
    revokeLocalObjectURL()
    clueImageUrl.value = ''
    clueImageError.value = false

    // 重置输入/提示状态
    answer.value = ''
    result.value = ''
    isSuccess.value = false
    loading.value = false

    // 4. 恢复默认背景音乐
    if (playDefault) playDefault()

    goToLevel(0)
  }
}

function goToLevel(level) {
  if (level < 0) return
  router.push(`/puzzle/${level}`)
  console.log('跳转至关卡', level)
}

function updateMaxLevel(level) {
  if (level > maxUnlockedLevel.value) {
    maxUnlockedLevel.value = level
    localStorage.setItem('puzzle_max_unlocked', level)
  }
}

function revokeLocalObjectURL() {
  if (currentObjectURL) {
    URL.revokeObjectURL(currentObjectURL)
    currentObjectURL = null
  }
}

// 安全调用背景音乐切换
async function switchBgm(bgmConfig, skipCache = false) {
  if (!changeBgm || !playDefault) return

  // 每次切换分配一个请求 id，以便在异步完成后判断是否为最新请求
  const reqId = ++bgmRequestCounter
  currentBgmRequestId = reqId

  // 无配置时播放默认音乐，但仍视为一次切换请求
  if (!bgmConfig) {
    console.log('未设置背景音乐，播放默认音乐中')
    try {
      await changeBgm(null, reqId)
    } catch (e) {
      console.warn('切换背景音乐失败:', e)
    }
    // 仅当该请求仍为最新时写缓存，避免旧请求覆盖新配置
    if (!skipCache && reqId === currentBgmRequestId) {
      cacheBgmConfig(null)
    }
    return
  }

  try {
    await changeBgm(bgmConfig, reqId)
    // 仅当该请求仍为最新时写缓存，避免旧请求覆盖新配置
    if (!skipCache && reqId === currentBgmRequestId) {
      cacheBgmConfig(bgmConfig)
    }
  } catch (e) {
    console.warn('切换背景音乐失败:', e)
  }
}

// 缓存bgm配置
function cacheBgmConfig(bgmConfig) {
  if (!bgmConfig) {
    localStorage.removeItem('last_bgm_config')
    return
  }
  try {
    localStorage.setItem('last_bgm_config', JSON.stringify(bgmConfig))
  } catch (e) {
    console.warn('缓存 BGM 配置失败', e)
  }
}

function cacheFinalBgmConfig(bgmConfig) {
  if (!bgmConfig) {
    localStorage.removeItem('final_bgm_config')
    return
  }
  try {
    localStorage.setItem('final_bgm_config', JSON.stringify(bgmConfig))
  } catch (e) {
    console.warn('缓存 BGM 配置失败', e)
  }
}

// 从 localStorage 恢复 BGM 配置
async function restoreCachedBgm(config = 'last_bgm_config') {
  const cached = localStorage.getItem(config)
  if (cached) {
    try {
      const config = JSON.parse(cached)
      if (config && (config.file || config.musicId)) {
        // 恢复缓存时不再写回缓存，避免与并发切换产生覆盖
        await switchBgm(config, true)
        return
      }
    } catch (e) {
      console.warn('BGM 缓存解析失败')
    }
  }
  // 无有效缓存，播放默认音乐
  if (playDefault) playDefault()
}

// 下载结局音乐并缓存到 IndexedDB
async function cacheEndingMusic(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('下载结局音乐失败')
    const blob = await response.blob()
    await saveClueImageBlob('endingMusic', blob)
  } catch (e) {
    console.warn('缓存结局音乐失败:', e)
  }
}

// ==================== 生命周期与监听 ====================
onMounted(async () => {
  const token = localStorage.getItem('game_token')
  if (!token) await startGame()

  if (getGameCompleted()) {
    gameCompleted.value = true

    endingAssetTimer = setTimeout(() => {
      if (!endingImageUrl.value && !endingImageError.value && !endingImageTimeout.value) {
        endingAssetTimeout.value = true
        console.warn('结局资源总超时')
      }
    }, 60000)

    // 快速校验：如果连缓存都没有，提前标记异常
    const cached = await getClueImageBlob('ending')
    if (!cached && !getEndingImage()) {
      // 没有任何可用图片资源，立即提示
      endingAssetTimeout.value = true
      if (endingAssetTimer) clearTimeout(endingAssetTimer)
    } else {
      await loadEndingAssets()
    }
    return

  }

  await restoreCachedBgm()
  await loadPuzzle(props.level)
  await loadLocalClue(props.level)
})

watch(() => props.level, async (newLevel) => {
  if (!gameCompleted.value) {
    await loadPuzzle(newLevel)
    await loadLocalClue(newLevel)
  }
})

watch(endingImageUrl, (newUrl) => {
  // 清除旧的定时器和状态
  clearEndingImgTimer()
  endingImageError.value = false
  endingImageTimeout.value = false

  if (!newUrl) return

  // 启动图片加载超时计时, 30s
  endingImgTimer = setTimeout(() => {
    if (!endingImageError.value) {
      endingImageTimeout.value = true
      console.warn('结局图片加载超时')
    }
  }, 30000)
})

onBeforeUnmount(() => {
  revokeLocalObjectURL()
  if (endingObjectURL) {
    URL.revokeObjectURL(endingObjectURL)
    endingObjectURL = null
  }
  clearEndingImgTimer()
  if (endingAssetTimer) clearTimeout(endingAssetTimer)
})

// ==================== 关卡数据与音乐加载 ====================
async function loadPuzzle(level) {
  try {
    const data = await fetchPuzzle(level)
    currentTitle.value = data.title
    currentContent.value = data.content
    updateMaxLevel(level)

    // 根据后端返回的 bgm 参数切换背景音乐
    if (data.bgm) {
      await switchBgm(data.bgm)
    } else {
      await switchBgm(null)
    }
  } catch (e) {

    if (e instanceof TokenExpiredError) {
      if (confirm('游戏凭证已过期，需要重新开始。\n点击“确定”将清除所有进度并获取新凭证。')) {
        await restartGameDueToExpiry()
      } else {
        alert('凭证已失效，后续操作将无法正常进行。你可以点击页面上的重置按钮或刷新页面重新开始。')
      }
    } else if (e.message === '无权限访问该关卡') {
      router.push('/puzzle/0')
    } else {
      currentTitle.value = '错误'
      currentContent.value = '<p>获取关卡数据失败，请刷新重试</p>'
    }
  }
}

// ==================== 线索图片缓存与恢复 ====================
async function loadLocalClue(level) {
  revokeLocalObjectURL()
  clueImageUrl.value = ''
  clueImageError.value = false

  try {
    const cached = await getClueImageBlob(level)
    if (!cached) {
      const {clueFileHash, clueFileUrl, success} = await refetchPuzzle(props.level)
      if (success) {
        await cacheImageAndNavigate(clueFileUrl, clueFileHash, props.level);
        location.reload()
      }
    }

    if (cached instanceof Blob) {
      currentObjectURL = URL.createObjectURL(cached)
      clueImageUrl.value = currentObjectURL
    } else if (typeof cached === 'string') {
      const response = await fetch(url)
      if (!response.ok) throw new Error('图片下载失败')
      clueImageUrl.value = cached
    }
  } catch (error) {
    console.error('从 IndexedDB 读取缓存图片失败:', error)
    try {
      console.log('尝试重新获取图片中')
      const {clueFileHash, clueFileUrl, success} = await refetchPuzzle(props.level)
      if (success) {
        await cacheImageAndNavigate(clueFileUrl, clueFileHash, props.level);
        location.reload()
      }
    }catch (error) {
      console.error('图片仍处于错误状态', error)
    }
  }
}

async function retryLoadClue() {
  clueImageError.value = false
  await nextTick()
  await loadLocalClue(props.level)
  console.log(clueImageError.value)
}

// ==================== 图片预缓存逻辑 ====================
async function cacheImageAndNavigate(url, backendHash, nextLevel) {
  try {
    const cached = await getClueImageBlob(nextLevel)
    const localHash = localStorage.getItem(`clue_hash_${nextLevel}`)

    if (cached instanceof Blob && localHash === backendHash) {
      router.push(`/puzzle/${nextLevel}`)
      result.value = ''
      return
    }

    const response = await fetch(url)
    if (!response.ok) throw new Error('图片下载失败')
    const blob = await response.blob()
    await saveClueImageBlob(nextLevel, blob)
    if (backendHash) localStorage.setItem(`clue_hash_${nextLevel}`, backendHash)
  } catch (error) {
    console.warn('图片预缓存失败，降级保存原始 URL:', error)
    const existing = await getClueImageBlob(nextLevel)
    if (!existing) await saveClueImageBlob(nextLevel, url)
    localStorage.removeItem(`clue_hash_${nextLevel}`)
  } finally {
    router.push(`/puzzle/${nextLevel}`)
    result.value = ''
  }
}

// ==================== 通关结局资源缓存 ====================
async function cacheEndingAssets(url, backendHash) {
  try {
    const cached = await getClueImageBlob('ending')
    const localHash = localStorage.getItem('clue_hash_ending')

    if (cached instanceof Blob && localHash === backendHash) return

    const response = await fetch(url)
    if (response.ok) {
      const blob = await response.blob()
      await saveClueImageBlob('ending', blob)
      if (backendHash) {
        localStorage.setItem('clue_hash_ending', backendHash)
      }
    }
  } catch (e) {
    console.warn('缓存结局图片失败:', e)
  }
}

// 加载通关结局资源（图片 + 音乐）
async function loadEndingAssets() {
  try {
    currentTitle.value = '恭喜通关'
    currentContent.value = '<p>你已成功解锁结局</p>'

    // 加载结局图片
    const cached = await getClueImageBlob('ending')
    if (cached instanceof Blob) {
      if (endingObjectURL) URL.revokeObjectURL(endingObjectURL)
      endingObjectURL = URL.createObjectURL(cached)
      endingImageUrl.value = endingObjectURL
    } else {
      endingImageUrl.value = getEndingImage()
    }

    // 加载结局音乐（从 IndexedDB 缓存读取并播放）
    // let musicUrl = null;
    // try {
    //   const musicBlob = await getClueImageBlob('endingMusic');
    //   if (musicBlob instanceof Blob) {
    //     musicUrl = URL.createObjectURL(musicBlob);
    //   } else {
    //     throw new Error('No blob');
    //   }
    // } catch (e) {
    //   // 缓存失效 → 从后端重新获取临时链接
    //   console.log('结局音乐缓存失效，尝试从服务器重新获取...');
    //   try {
    //     const assets = await fetchEndingAssets();
    //     if (assets.endingMusicUrl) {
    //       musicUrl = assets.endingMusicUrl;
    //       // 顺便重新下载并缓存，供本次会话使用（不强制依赖）
    //       cacheEndingMusic(assets.endingMusicUrl).catch(() => { });
    //     }
    //   } catch (err) {
    //     console.error('重新获取结局音乐失败:', err);
    //   }
    // }

    // if (musicUrl) {
    //   await switchBgm({ file: musicUrl }, true);
    // }

    // 加载结局音乐, 改为获取密钥解码
    let music = null
    try {
      music = restoreCachedBgm('final_bgm_config')
    } catch (e) {
      console.error('结局音乐解码失败:', e)
      try {
        const assets = await fetchEndingAssets()
        if (assets.finalBgm) {
          music = assets.finalBgm
          cacheFinalBgmConfig(assets.finalBgm)
        }
      } catch (err) {
        console.error('重新获取结局音乐失败:', err)
      }
    }

    if (music) {
      await switchBgm(music)
    }

    if (!rewardCheck.value) {
      rewardCheck.value = (await fetchEndingAssets()).reward || false
      console.log('剩余奖励', rewardCheck.value)
      if (rewardCheck.value != true) {
        rewardCheck.value = false
      }
    }

    if (endingAssetTimer) {
      clearTimeout(endingAssetTimer)
      endingAssetTimer = null
    }

  } catch (e) {
    endingImageUrl.value = getEndingImage()
  }
}

// ==================== 答案提交与流程控制 ====================
async function handleSubmit() {
  const raw = validateAndNormalize(answer.value)
  if (!raw.valid) {
    result.value = raw.error;
    return
  }
  const userAnswer = raw.normalized || answer.value.trim()
  if (!userAnswer) {
    result.value = '请输入答案';
    return
  }

  loading.value = true
  result.value = ''
  isSuccess.value = false

  try {
    const data = await checkAnswer(parseInt(props.level), userAnswer)

    result.value = data.message || (data.success ? '🎉 答案正确！正在加载...' : data.error || '答案错误，请再试试。')
    isSuccess.value = data.success

    if (!data.success) return

    answer.value = ''
    const currentLevelNum = parseInt(props.level)

    // ---------- 通关结局 ----------
    if (data.endingImageUrl) {
      result.value = '🎉 正在解锁最终真相...'

      if (data.reward) {
        rewardCheck.value = true
      }

      // 缓存结局图片
      await cacheEndingAssets(data.endingImageUrl, data.endingImageHash)

      // 如果有结局音乐，先缓存到config
      if (data.finalBgm) {
        await cacheFinalBgmConfig(data.finalBgm)
        // await cacheEndingMusic(data.endingMusicUrl)
      }

      setGameCompleted(data.endingImageUrl)
      gameCompleted.value = true
      // 统一加载结局资源（图片 + 音乐，音乐从缓存读取并播放）
      await loadEndingAssets()
      return
    }

    // ---------- 普通关卡：解锁下一关并预缓存线索图 ----------
    if (data.clueFileUrl) {
      const nextLevel = currentLevelNum + 1
      updateMaxLevel(nextLevel)

      // 缓存线索图并跳转
      await cacheImageAndNavigate(data.clueFileUrl, data.clueFileHash, nextLevel)
    }
  } catch (error) {
    if (e instanceof TokenExpiredError) {
      if (confirm('游戏凭证已过期，需要重新开始。\n点击“确定”将清除所有进度并获取新凭证。')) {
        await restartGameDueToExpiry()
      } else {
        alert('凭证已失效，后续操作将无法正常进行。你可以点击页面上的重置按钮或刷新页面重新开始。')
      }
    }
    console.error('答案提交异常:', error)
    result.value = '网络错误，请检查网络后重试'
  } finally {
    loading.value = false
  }
}

async function restartGameDueToExpiry() {
  if (isRestartingAfterExpiry) return;
  isRestartingAfterExpiry = true;

  try {
    localStorage.clear();
    indexedDB.deleteDatabase('GameImageDB');

    gameCompleted.value = false;
    endingImageUrl.value = '';
    endingImageError.value = false;
    endingImageTimeout.value = false;
    endingAssetTimeout.value = false;
    maxUnlockedLevel.value = 0;
    rewardCheck.value = false;
    infoSubmitted.value = false;
    showInfoModal.value = false;
    answer.value = '';
    result.value = '';
    loading.value = false;
    isSuccess.value = false;

    revokeLocalObjectURL();
    if (endingObjectURL) {
      URL.revokeObjectURL(endingObjectURL);
      endingObjectURL = null;
    }
    clearEndingImgTimer();
    if (endingAssetTimer) clearTimeout(endingAssetTimer);

    // 获取全新的游戏 token
    const data = await startGame();
    if (!data.token) {
      alert('重新开始失败，请刷新页面重试');
      return;
    }

    router.push('/puzzle/0');

  } catch (e) {
    console.error('重启失败:', e);
    alert('游戏重启异常，请刷新页面');
  } finally {
    isRestartingAfterExpiry = false;
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

.submit-info-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 0.7rem 1.8rem;
  border-radius: 30px;
  font-size: 1.1rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.submit-info-btn:hover {
  transform: scale(1.05);
}
</style>
