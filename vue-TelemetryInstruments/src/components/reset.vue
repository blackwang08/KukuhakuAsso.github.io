<template>
    <div v-if="visible" class="reset-btn-container">
        <button class="reset-btn" :disabled="gameCompleted == false" @click="$emit('reset')">
            重置进度并回到初始状态
        </button>
    </div>
</template>

<script setup>
defineProps({
    gameCompleted: {
        type: Boolean,
        default: false,
    },
    visible: {
        type: Boolean,
        default: true,
    },
})

defineEmits(['reset'])
</script>

<style scoped>
.reset-btn-container {
    display: flex;
    justify-content: center;
    margin: 20px 0;
}

.reset-btn {
    padding: 12px 28px;
    font-size: 15px;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 14px rgba(231, 76, 60, 0.35);
    letter-spacing: 1px;
}

.reset-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(231, 76, 60, 0.5);
    background: linear-gradient(135deg, #f0544a, #d63031);
}

.reset-btn:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
}

.reset-btn:disabled {
    background: linear-gradient(135deg, #bdc3c7, #95a5a6);
    box-shadow: none;
    cursor: not-allowed;
    opacity: 0.6;
}
</style>
