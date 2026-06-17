<template>
    <Teleport to="body">
        <Transition name="modal">
            <div v-if="visible" class="modal-overlay" @click.self="close">
                <div class="modal-content">
                    <h2>恭喜通关！请填写联系方式，可能会有实物奖品发放</h2>
                    <form @submit.prevent="handleSubmit">
                        <div class="form-item">
                            <label>称呼</label>
                            <input v-model.trim="form.name" placeholder="请输入个人称呼" required />
                        </div>
                        <div class="form-item">
                            <label>队伍名</label>
                            <input v-model.trim="form.team" placeholder="请输入队伍名，可留空" />
                        </div>
                        <div class="form-item">
                            <label>联系邮箱</label>
                            <input v-model.trim="form.mail" placeholder="请输入可用的邮箱账号"/>
                        </div>
                        <div class="form-item">
                            <label>其他联系方式</label>
                            <input v-model.trim="form.contact" placeholder="请输入其他联系方式，比如QQ或b站UID"/>
                        </div>
                        
                        <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
                        <p v-if="successMsg" class="success-msg">{{ successMsg }}</p>
                        <div class="modal-actions">
                            <button type="submit" :disabled="submitting">
                                {{ submitting ? '提交中...' : '提交信息' }}
                            </button>
                            <button type="button" class="cancel-btn" @click="close" :disabled="submitting">关闭</button>
                        </div>
                    </form>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { uploadInfo } from '../utils/authFetch'

const props = defineProps({
    visible: Boolean
})
const emit = defineEmits(['update:visible', 'submitted'])

const form = ref({
    name: '',
    team: '',
    mail: '',
    contact: ''
})
const submitting = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// 弹窗打开时重置表单和提示
watch(() => props.visible, (val) => {
    if (val) {
        form.value.name = ''
        form.value.team = ''
        form.value.mail = ''
        form.value.contact = ''
        errorMsg.value = ''
        successMsg.value = ''
    }
})

function close() {
    emit('update:visible', false)
}

async function handleSubmit() {
    // 简单校验
    if (!form.value.name || !(form.value.contact || form.value.mail)) {
        errorMsg.value = '请填写称呼和至少一种联系方式'
        return
    }

    // 校验邮箱
    if(form.value.mail != ''){
        const mailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!mailRegex.test(form.value.mail)) {
            errorMsg.value = '请输入有效的邮箱地址'
            return
        }
    }

    submitting.value = true
    errorMsg.value = ''
    successMsg.value = ''

    try {
        await uploadInfo(form.value)
        successMsg.value = '信息提交成功！感谢你的参与。'
        // 标记已提交，持久化到 localStorage
        localStorage.setItem('puzzle_info_submitted', 'true')
        emit('submitted')
        // 2秒后自动关闭
        setTimeout(() => {
            close()
        }, 2000)
    } catch (e) {
        errorMsg.value = e.message || '提交失败，请稍后重试'
    } finally {
        submitting.value = false
    }
}
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.modal-content {
    background: #fff;
    border-radius: 12px;
    padding: 2rem;
    width: 90%;
    max-width: 420px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
    color: #333;
}

h2 {
    margin-top: 0;
    color: var(--text-h, #222);
}

.form-item {
    margin-bottom: 1rem;
}

.form-item label {
    display: block;
    margin-bottom: 0.3rem;
    font-weight: 500;
    color: #555;
}

.form-item input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #ccc;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
}

.form-item input:focus {
    outline: none;
    border-color: #4a90d9;
    box-shadow: 0 0 0 2px rgba(74, 144, 217, 0.2);
}

.modal-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
    justify-content: flex-end;
}

button {
    padding: 0.5rem 1.2rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    background: #4a90d9;
    color: #fff;
    transition: background 0.2s;
}

button:hover:not(:disabled) {
    background: #357abd;
}

button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.cancel-btn {
    background: #eee;
    color: #333;
}

.cancel-btn:hover:not(:disabled) {
    background: #ddd;
}

.error-msg {
    color: #d32f2f;
    margin: 0.5rem 0 0;
}

.success-msg {
    color: #2e7d32;
    margin: 0.5rem 0 0;
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}
</style>
