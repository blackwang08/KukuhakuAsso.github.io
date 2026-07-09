<template>
  <div id="app" :class="{ dark: isDark }">
    <Header @toggle-bgm="toggleBgm" />
    <AudioPlayer ref="audioPlayerRef" />
    <router-view />
  </div>
</template>

<script setup>
import { ref, watchEffect, provide, onMounted } from 'vue'
import { useDark } from '@vueuse/core'
import Header from './components/header.vue'
import AudioPlayer from './components/audioPlayer.vue'

const volume = ref(0.75)               // 音量
const audioPlayerRef = ref(null)
const isBgmPlaying = ref(false)

// 💡 修复 2：删除了 onMounted 中的手写逻辑，统一使用 VueUse 管理深色模式
// 这里的配置必须和 header.vue 完全一致！它会自动处理系统偏好(prefers-color-scheme)
const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: 'light',
  storageKey: null,
})

// 开启 BGM 并播放（供 Header 拖动滑块时调用）
function playBgm() {
  isBgmPlaying.value = true
  audioPlayerRef.value?.play()
}

// 切换 BGM 播放/暂停
function toggleBgm() {
  isBgmPlaying.value = !isBgmPlaying.value
  if (isBgmPlaying.value) {
    audioPlayerRef.value?.play()
  } else {
    audioPlayerRef.value?.pause()
  }
}

// 变更 BGM
function changeBgm(musicData, requestId) {
  // 传入 requestId，供 audioPlayer 在异步加载完成后判断是否过期
  audioPlayerRef.value?.changePlayMusic(musicData, requestId)
}

function playDefault() {
  audioPlayerRef.value?.playDefault()
}

// 同步播放状态
watchEffect(() => {
  isBgmPlaying.value = audioPlayerRef.value?.isPlaying ?? false
})

// 依赖注入 (这里的 isBgmPlaying 注入给 header.vue 用得正好)
provide('changeBgm', changeBgm)
provide('isBgmPlaying', isBgmPlaying)
provide('volume', volume)
provide('playBgm', playBgm)
provide('playDefault', playDefault)

// —— 跨域名数据迁移：从旧域名通过 URL 参数 _migrate 携带数据迁移到新域名 ——
onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const migrateDataString = urlParams.get('_migrate')

  if (migrateDataString) {
    try {
      // 1. 解码并解析传过来的 localStorage 数据
      const migrateData = JSON.parse(decodeURIComponent(migrateDataString))

      // 2. 遍历并写入到当前域名的 localStorage 中
      for (const key in migrateData) {
        if (Object.prototype.hasOwnProperty.call(migrateData, key)) {
          localStorage.setItem(key, migrateData[key])
        }
      }

      console.log('GitHub Pages 数据同步成功！')

      // 3. 抹除 URL 中的 _migrate 参数，保持地址栏干净，并防止刷新时重复执行
      urlParams.delete('_migrate')
      const newSearch = urlParams.toString() ? '?' + urlParams.toString() : ''
      // 注意保留 Hash
      const cleanUrl = window.location.pathname + newSearch + window.location.hash
      window.history.replaceState({}, '', cleanUrl)
    } catch (error) {
      console.error('解析迁移数据失败:', error)
    }
  }
})
</script>
