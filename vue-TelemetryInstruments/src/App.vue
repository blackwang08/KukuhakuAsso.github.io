<template>
  <div id="app" :class="{ dark: isDark }">
    <Header @toggle-bgm="toggleBgm" />
    <AudioPlayer ref="audioPlayerRef" />
    <router-view />
  </div>
</template>

<script setup>
import { ref, watchEffect, provide } from 'vue'
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
function changeBgm(musicData) {
  audioPlayerRef.value?.changePlayMusic(musicData)
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
</script>
