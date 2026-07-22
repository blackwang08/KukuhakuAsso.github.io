<!-- .vitepress/theme/components/Author.vue -->
<script setup>
import { useData } from 'vitepress'

const { frontmatter } = useData()
</script>

<template>
    <div v-if="frontmatter.author" class="author-container">
        <span class="author-name">
            {{ Array.isArray(frontmatter.author) ? frontmatter.author.join('、') : frontmatter.author }}
        </span>
    </div>
</template>

<style scoped>
.author-container {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
    font-size: 0.9rem;
    color: var(--vp-c-text-2);
}

.author-name {
    font-weight: 500;
}
</style>
