<template>
  <!-- 模板部分与您提供的完全相同，无需改动 -->
  <div class="rag-page-container p-4">
    <Builder
      v-if="viewState === 'building'"
      @build-completed="switchToChat"
      @skip-build="switchToChat"
    />

    <div v-else-if="viewState === 'chatting'" class="chat-page-wrapper">
      <Card title="智能问答助手" :body-style="{ padding: 0 }" class="full-height-card">
        <template #extra>
          <a-space>
            <a-button @click="showModal('kb')">查看知识库</a-button>
            <a-button @click="showModal('kg')">查看知识图谱</a-button>
          </a-space>
        </template>
        <div class="chat-container">
          <!-- 对话展示区域 -->
          <div class="message-list" ref="messageListRef">
            <div v-for="(message, index) in messages" :key="index" :class="['message-item', message.role]">
              <div class="avatar">
                {{ message.role === 'user' ? '我' : '答' }}
              </div>
              <div class="message-content">
                <div v-if="message.isTyping">
                  <a-spin />
                </div>
                <!-- 使用 v-html 和 DOMPurify 进行安全渲染 -->
                <div v-else v-html="secureRenderMarkdown(message.content)"></div>
              </div>
            </div>
          </div>

          <!-- 输入区域 -->
          <div class="input-area">
            <a-textarea
              v-model:value="userInput"
              placeholder="请输入你的问题，按 Enter 发送..."
              :auto-size="{ minRows: 1, maxRows: 5 }"
              @keypress.enter.prevent="handleSendMessage"
              :disabled="isLoading"
            />
            <!-- 根据 isLoading 状态显示不同按钮 -->
            <a-button v-if="!isLoading" type="primary" @click="handleSendMessage" class="ml-2">发送</a-button>
            <a-button v-else danger @click="stopGeneration" class="ml-2">停止</a-button>
          </div>
        </div>
      </Card>

      <!-- 
        [FIXED] 移除了未使用的 a-drawer 组件。
        这个组件是导致页面初始时出现不必要的 "加载中" 动画并扰乱布局的根源。
      -->

      <a-modal v-model:open ="modalVisible" :title="modalTitle" width="80%" :footer="null" destroyOnClose>
        <docuview v-if="modalContent === 'kb'" />
        <kgview v-if="modalContent === 'kg'" />
      </a-modal>
  </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, nextTick, shallowRef,computed,defineAsyncComponent } from 'vue';
import { Card, Input, Button, Spin, message as AntMessage, Space, Modal  } from 'ant-design-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAccessStore } from '@vben/stores'; 

const Builder = defineAsyncComponent(() => import('./builder.vue'));
const docuview = defineAsyncComponent(() => import('./docuview.vue'));
const kgview = defineAsyncComponent(() => import('./kgview.vue'));

type ViewState = 'building' | 'chatting';
const viewState = ref<ViewState>('building'); 

const switchToChat = () => {
  viewState.value = 'chatting';
};

const ASpace = Space;
const AModal = Modal;
const ATextarea = Input.TextArea;

marked.setOptions({ async: false });

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isTyping?: boolean;
}

const messages = ref<Message[]>([
  { role: 'assistant', content: '你好！有什么可以帮助你的吗？' }
]);

const userInput = ref('');
const isLoading = ref(false);
const messageListRef = ref<HTMLElement | null>(null);
const eventSource = shallowRef<EventSource | null>(null);
const accessStore = useAccessStore();

// --- [FIXED] 移除了所有与 a-drawer 相关的逻辑 ---

const scrollToBottom = () => {
  nextTick(() => {
    const el = messageListRef.value;
    if (el) {
      const last = el.lastElementChild;
      last?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  });
};

const stopGeneration = () => {
  if (eventSource.value) {
    eventSource.value.close();
    eventSource.value = null;
  }
  isLoading.value = false;
  const lastMessage = messages.value[messages.value.length - 1];
  if (lastMessage && lastMessage.isTyping) {
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
  
  eventSource.value = new EventSource(sseUrl, {
    withCredentials: true 
  });

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
    } catch (e) {
      // 忽略解析错误
    }

    try {
      const textChunk = JSON.parse(data);
      if (typeof textChunk === 'string') {
        lastMessage.content += textChunk;
        scrollToBottom();
      }
    } catch (parseError) {
      console.error("无法解析收到的 SSE 数据:", data, parseError);
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

// Modal 相关逻辑
const modalVisible = ref(false);
const modalContent = ref<'kb' | 'kg'>('kb');
const modalTitle = computed(() => modalContent.value === 'kb' ? '知识库文档' : '知识图谱');
const showModal = (type: 'kb' | 'kg') => {
  modalContent.value = type;
  modalVisible.value = true;
};

defineExpose({
  sendQuery,
});
</script>

<style scoped>
@import './literag.scss';
</style>
