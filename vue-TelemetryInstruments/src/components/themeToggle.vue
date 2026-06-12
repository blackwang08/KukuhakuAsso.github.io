<script setup>
import { computed } from 'vue'
import { useTheme } from './useTheme'

const { isDark, cycle } = useTheme()

const icon = computed(() => isDark.value ? '☀️' : '🌙')
</script>

<template>
    <button class="theme-toggle" aria-label="切换主题（自动/亮/暗）" @click="cycle">
        <span class="icon">{{ icon }}</span>
    </button>
</template>


<style scoped>
.theme-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid transparent;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    font-size: 18px;
    color: var(--text-h);
    transition: border-color 0.25s, background 0.25s;
}

.theme-toggle:hover {
    border-color: var(--border);
    background: var(--code-bg);
}

.icon {
    display: inline-block;
    transition: transform 0.3s ease;
}
</style>
