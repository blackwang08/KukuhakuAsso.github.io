<script setup>
import { useData } from 'vitepress'

const { frontmatter } = useData()
</script>

<template>
    <div v-if="frontmatter.tags" class="tags-container">
        <span class="tag" v-for="tag in frontmatter.tags" :key="tag">
            {{ tag }}
        </span>
    </div>
</template>

<style scoped>
.tags-container {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--vp-c-divider);
}

.tag {
    display: inline-block;
    background: var(--vp-c-bg-soft);
    color: var(--vp-c-text-1);
    padding: 2px 10px;
    margin-right: 8px;
    margin-bottom: 6px;
    border-radius: 12px;
    font-size: 0.85rem;
}
</style>
