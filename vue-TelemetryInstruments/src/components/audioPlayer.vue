<template>
    <audio ref="bgMusic" loop preload="auto" crossorigin="anonymous"></audio>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import defaultBgm from '@/assets/bgm.mp3' // 默认背景音乐

const bgMusic = ref(null)
const isPlaying = ref(false)
const currentBlobUrl = ref(null)

// 后备 MIME 判断（仅在后端未提供时使用）
function getMimeType(filename) {
    const ext = filename.split('.').pop().toLowerCase()
    if (ext === 'enc') {
        const parts = filename.split('.')
        const realExt = parts.length > 1 ? parts[parts.length - 2]?.toLowerCase() : ''
        const mimeMap = {
            mp3: 'audio/mpeg',
            flac: 'audio/flac',
            wav: 'audio/wav',
            ogg: 'audio/ogg',
            m4a: 'audio/mp4',
            aac: 'audio/aac'
        }
        return mimeMap[realExt] || 'audio/mpeg'
    }
    const mimeMap = {
        mp3: 'audio/mpeg',
        flac: 'audio/flac',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
        m4a: 'audio/mp4',
        aac: 'audio/aac'
    }
    return mimeMap[ext] || 'audio/mpeg'
}

// 释放旧的 Blob URL（如果有）
function revokeCurrentBlob() {
    if (currentBlobUrl.value) {
        URL.revokeObjectURL(currentBlobUrl.value)
        currentBlobUrl.value = null
    }
}

// 播放默认音乐（assets 中的本地文件）
function playDefault() {
    const audioEl = bgMusic.value
    if (!audioEl) return

    // 停止当前播放，清除之前的 Blob URL
    audioEl.pause()
    revokeCurrentBlob()

    // 设置默认音乐文件（无需 Blob）
    audioEl.src = defaultBgm
    audioEl.load()

    // 尝试播放（如果浏览器已解锁）
    audioEl.play().then(() => {
        isPlaying.value = true
    }).catch(() => {
        isPlaying.value = false
    })
}

const tryPlayMusic = async () => {
    if (!bgMusic.value) return
    try {
        await bgMusic.value.play()
        isPlaying.value = true
        document.removeEventListener('click', tryPlayMusic)
        document.removeEventListener('touchstart', tryPlayMusic)
    } catch (error) {
        console.warn('自动播放被拦截，等待用户交互：', error.message)
        isPlaying.value = false
    }
}

/**
 * 切换背景音乐
 * @param {Object} [musicData]  可选，不传或无效时回退到默认音乐
 * @param {string} musicData.file         文件名，相对于 public 目录
 * @param {string} [musicData.keyBase64]  加密密钥（Base64）
 * @param {string} [musicData.ivBase64]   初始化向量（Base64）
 * @param {string} [musicData.mimeType]   MIME 类型（后端提供）
 */
const changePlayMusic = async (musicData) => {
    // 无有效数据 -> 播放默认音乐
    if (!musicData || !musicData.file) {
        playDefault()
        return
    }

    const { file, keyBase64, ivBase64, mimeType: providedMime } = musicData
    const audioEl = bgMusic.value
    if (!audioEl) return

    // 清除之前的 Blob URL
    revokeCurrentBlob()
    audioEl.pause()

    const isEncrypted = file.toLowerCase().endsWith('.enc')

    try {
        if (isEncrypted) {
            if (!keyBase64 || !ivBase64) {
                console.error('加密文件缺少 keyBase64 或 ivBase64，无法解密')
                playDefault()
                return
            }

            const encUrl = '/' + file.replace(/\\/g, '/')
            const encRes = await fetch(encUrl)
            if (!encRes.ok) throw new Error(`加密文件加载失败: ${encRes.status}`)
            const encryptedBuffer = await encRes.arrayBuffer()

            const rawKey = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
            const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0))
            const cryptoKey = await crypto.subtle.importKey(
                'raw', rawKey,
                { name: 'AES-CBC' },
                false,
                ['decrypt']
            )
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-CBC', iv },
                cryptoKey,
                encryptedBuffer
            )

            const mimeType = providedMime || getMimeType(file)
            const blob = new Blob([decrypted], { type: mimeType })
            currentBlobUrl.value = URL.createObjectURL(blob)
            audioEl.src = currentBlobUrl.value
        } else {
            // 明文文件直接播放
            const plainUrl = '/' + file.replace(/\\/g, '/')
            audioEl.src = plainUrl
        }

        audioEl.load()
        // 如果之前处于播放状态或用户已交互，自动续播
        if (isPlaying.value) {
            await audioEl.play()
            isPlaying.value = true
        } else {
            isPlaying.value = false
        }
    } catch (err) {
        console.error('音乐切换失败，回退到默认音乐：', err)
        playDefault()
    }
}

const togglePlay = () => {
    if (!bgMusic.value) return
    if (isPlaying.value) {
        bgMusic.value.pause()
        isPlaying.value = false
    } else {
        bgMusic.value.play().then(() => {
            isPlaying.value = true
        }).catch(() => {
            isPlaying.value = false
        })
    }
}

onMounted(() => {
    // 组件初始化时，如果没有设置任何音乐，则播放默认音乐
    const audioEl = bgMusic.value
    if (audioEl && !audioEl.src) {
        playDefault()
    }
    tryPlayMusic()
    document.addEventListener('click', tryPlayMusic)
    document.addEventListener('touchstart', tryPlayMusic)
})

onUnmounted(() => {
    document.removeEventListener('click', tryPlayMusic)
    document.removeEventListener('touchstart', tryPlayMusic)
    revokeCurrentBlob()
})

defineExpose({
    isPlaying,
    togglePlay,
    changePlayMusic
})
</script>
