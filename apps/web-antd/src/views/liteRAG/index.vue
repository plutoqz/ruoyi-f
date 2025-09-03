<template>
  <div class="rag-page-container p-4">
    <!-- 
      [核心修复] 使用 v-show 而不是 v-if。
      v-show 只是切换 CSS display，不会销毁和重建组件，能与 <KeepAlive> 更好地协同工作。
    -->
    <Builder
      v-show="viewState === 'building'"
      @build-completed="switchToChat"
      @skip-build="switchToChat"
    />

    <div v-show="viewState === 'chatting'" class="chat-page-wrapper">
      <Card title="智能问答助手" :body-style="{ padding: 0 }" class="full-height-card">
        <template #extra>
          <a-space>
            <a-button @click="showModal('kb')">查看知识库</a-button>
            <a-button @click="showModal('kg')">查看知识图谱</a-button>
          </a-space>
        </template>
        <div class="chat-container">
          <div class="message-list" ref="messageListRef">
            <div v-for="(message, index) in messages" :key="index" :class="['message-item', message.role]">
              <div class="avatar">
                {{ message.role === 'user' ? '我' : '答' }}
              </div>
              <div class="message-content">
                <div v-if="message.isTyping">
                  <Spin />
                </div>
                <div v-else v-html="secureRenderMarkdown(message.content)"></div>
              </div>
            </div>
          </div>
          <div class="input-area">
            <a-textarea
              v-model:value="userInput"
              placeholder="请输入你的问题，按 Enter 发送..."
              :auto-size="{ minRows: 1, maxRows: 5 }"
              @keypress.enter.prevent="handleSendMessage"
              :disabled="isLoading"
            />
            <a-button v-if="!isLoading" type="primary" @click="handleSendMessage" class="ml-2">发送</a-button>
            <a-button v-else danger @click="stopGeneration" class="ml-2">停止</a-button>
          </div>
        </div>
      </Card>
      <a-modal v-model:open="modalVisible" :title="modalTitle" width="80%" :footer="null" destroyOnClose>
        <docuview v-if="modalContent === 'kb'" />
        <kgview v-if="modalContent === 'kg'" />
      </a-modal>
    </div>
  </div>
</template>

<script lang="ts" setup>
// [核心] 导入 KeepAlive 需要的 onActivated 和 onDeactivated
import { ref, nextTick, shallowRef, computed, onUnmounted, onActivated, onDeactivated } from 'vue';
import { Card, Input, Button, Spin, message as AntMessage, Space, Modal } from 'ant-design-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAccessStore } from '@vben/stores'; 
// 使用同步导入，确保组件在父组件挂载时已就绪
import Builder from './builder.vue'; 
import docuview from './docuview.vue';
import kgview from './kgview.vue';

// --- 视图状态 ---
type ViewState = 'building' | 'chatting';
const viewState = ref<ViewState>('building');

const switchToChat = () => {
  viewState.value = 'chatting';
};

// --- 你的原始代码和状态 (完整保留) ---
const ASpace = Space;
const AModal = Modal;
const ATextarea = Input.TextArea;
marked.setOptions({ async: false });
interface Message { role: 'user' | 'assistant'; content: string; isTyping?: boolean; }
const messages = ref<Message[]>([{ role: 'assistant', content: '你好！有什么可以帮助你的吗？' }]);
const userInput = ref('');
const isLoading = ref(false);
const messageListRef = ref<HTMLElement | null>(null);
const eventSource = shallowRef<EventSource | null>(null);
const accessStore = useAccessStore();

const scrollToBottom = () => {
  nextTick(() => {
    const el = messageListRef.value;
    if (el) {
      el.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  });
};

const stopGeneration = () => {
  if (eventSource.value) {
    eventSource.value.close();
    eventSource.value = null;
    console.log('[index.vue] EventSource connection closed.');
  }
  isLoading.value = false;
  const lastMessage = messages.value.at(-1);
  if (lastMessage?.isTyping) {
    messages.value.pop();
  }
};

const sendQuery = (question: string) => {
  if (!question || isLoading.value) return;
  messages.value.push({ role: 'user', content: question });
  scrollToBottom();
  messages.value.push({ role: 'assistant', content: '', isTyping: true });
  isLoading.value = true;
  scrollToBottom();
  const token = accessStore.accessToken;
  if (!token) {
    AntMessage.error('用户认证失败，请重新登录');
    const lastMessage = messages.value.at(-1);
    if (lastMessage) {
      lastMessage.isTyping = false;
      lastMessage.content = "认证失败，无法发送消息。";
    }
    isLoading.value = false;
    return;
  }
  const sseUrl = `/api/system/rag/stream-query?question=${encodeURIComponent(question)}`;
  eventSource.value = new EventSource(sseUrl, { withCredentials: true });
  const lastMessage = messages.value.at(-1)!;
  lastMessage.isTyping = false;
  eventSource.value.onmessage = (event) => {
    const data = event.data;
    if (data === '[DONE]') {
      stopGeneration();
      return;
    }
    try {
      const errorObj = JSON.parse(data);
      if (errorObj.error) {
        lastMessage.content = `**错误**: ${errorObj.error}`;
        stopGeneration();
        return;
      }
    } catch (e) { /* ignore */ }
    try {
      const textChunk = JSON.parse(data);
      if (typeof textChunk === 'string') {
        lastMessage.content += textChunk;
        scrollToBottom();
      }
    } catch (parseError) {
      console.error("Cannot parse SSE data:", data, parseError);
    }
  };
  eventSource.value.onerror = (error) => {
    console.error('EventSource failed:', error);
    const lastMessage = messages.value.at(-1);
    if (lastMessage && lastMessage.content === '') {
      lastMessage.content = '抱歉，连接问答服务失败。请检查网络或联系管理员。';
    }
    stopGeneration();
  };
};

const handleSendMessage = () => {
  const question = userInput.value.trim();
  if (question) {
    sendQuery(question);
    userInput.value = '';
  }
};

const secureRenderMarkdown = (text: string) => {
  const rawHtml = marked(text, { breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(rawHtml);
};

const modalVisible = ref(false);
const modalContent = ref<'kb' | 'kg'>('kb');
const modalTitle = computed(() => modalContent.value === 'kb' ? '知识库文档' : '知识图谱');
const showModal = (type: 'kb' | 'kg') => {
  modalContent.value = type;
  modalVisible.value = true;
};

// --- [核心修复] 为 index.vue 添加自己的生命周期管理 ---
onActivated(() => {
  console.log('[index.vue] Activated.');
  // 每次进入页面时，重置到初始的“构建”视图，确保状态可预测
  viewState.value = 'building';
});

onDeactivated(() => {
  console.log('[index.vue] Deactivated.');
  // 离开页面时，清理聊天相关的资源，防止泄漏
  stopGeneration();
});

onUnmounted(() => {
  console.log('[index.vue] Unmounted.');
  // 彻底销毁时，也执行清理
  stopGeneration();
});

defineExpose({
  sendQuery,
});
</script>

<style scoped>
@import './literag.scss';
</style>