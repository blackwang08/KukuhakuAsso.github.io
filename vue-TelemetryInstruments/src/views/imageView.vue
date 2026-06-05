<template>
    <div v-if="visible" class="image-viewer">
        <h3>{{ title }}</h3>
        <img :src="imageUrl" :alt="title" class="full-image" />
        <div class="actions">
            <slot name="actions">
                <button v-if="showNext" @click="$emit('next')" class="btn-next">进入下一关</button>
                <button @click="$emit('close')" class="btn-close">关闭</button>
            </slot>
        </div>
    </div>
</template>

<script setup>
defineProps({
    visible: {
        type: Boolean,
        default: false
    },
    imageUrl: {
        type: String,
        required: true
    },
    title: {
        type: String,
        default: '新线索'
    },
    showNext: {
        type: Boolean,
        default: false
    }
})

defineEmits(['close', 'next'])
</script>

<style scoped>
.image-viewer {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    /* 添加边框以区分常规内容 */
    text-align: center;
    width: 100%;
    box-sizing: border-box;
    /* 可选：添加一点阴影让它看起来更有层次 */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    margin: 1rem 0;
}

.full-image {
    max-width: 100%;
    /* 保留最大高度，防止图片过大撑破页面 */
    max-height: 60vh;
    object-fit: contain;
    border: 1px solid #ccc;
    margin: 1rem 0;
    border-radius: 4px;
}

.actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    /* 替换原有的 button margin */
}

.actions button {
    padding: 0.6rem 1.5rem;
    font-size: 1rem;
    cursor: pointer;
    border-radius: 4px;
    border: 1px solid #ccc;
    background: #f9f9f9;
}

.actions button:hover {
    background: #eee;
}
</style>
