<template>
  <div class="rag-page-container p-4">
    <Card title="智能问答助手"  :body-style="{ padding: 0 }" class="full-height-card">
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
            @keypress.enter.prevent="sendMessage"
            :disabled="isLoading"
          />
          <!-- 根据 isLoading 状态显示不同按钮 -->
          <a-button v-if="!isLoading" type="primary" @click="sendMessage" class="ml-2">发送</a-button>
          <a-button v-else danger @click="stopGeneration" class="ml-2">停止</a-button>
        </div>
      </div>
    </Card>

    <a-modal v-model:visible="modalVisible" :title="modalTitle" width="80%" :footer="null" destroyOnClose>
      <docuview v-if="modalContent === 'kb'" />
      <kgview v-if="modalContent === 'kg'" :visible="modalVisible"/>
    </a-modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, nextTick, shallowRef,computed } from 'vue';
import { Card, Input, Button, Spin, message as AntMessage, Space, Modal  } from 'ant-design-vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useAccessStore } from '@vben/stores'; // 引入用于获取 Token 的 store
import docuview from './docuview.vue'
import kgview from './kgview.vue';
// 确保你的项目中存在 @vben/stores 并导出了 useAccessStore
// 如果你的 store 不叫这个名字，请替换成你项目中实际的 store
const ASpace = Space;
const AModal = Modal;
// 强制同步渲染
marked.setOptions({ async: false });

const ATextarea = Input.TextArea;

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
const accessStore = useAccessStore(); // 获取 store 实例

const scrollToBottom = () => {
  nextTick(() => {
    const el = messageListRef.value;
    if (el) {
      /* 关键：用 scrollIntoView 把最后一条消息顶进可视区域 */
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
};

const sendMessage = () => {
  const question = userInput.value.trim();
  if (!question || isLoading.value) return;

  messages.value.push({ role: 'user', content: question });
  userInput.value = '';
  scrollToBottom();

  messages.value.push({ role: 'assistant', content: '', isTyping: true });
  isLoading.value = true;
  scrollToBottom();
  
  // 1. 获取 Token
  const token = accessStore.accessToken;
  if (!token) {
      AntMessage.error('用户认证失败，请重新登录');
      stopGeneration(); // 停止加载状态
      // 将占位消息替换为错误提示
      const lastMessage = messages.value.at(-1);
      if (lastMessage) lastMessage.content = "认证失败，无法发送消息。";
      return;
  }
  
  // 2. 构建带 Token 的 SSE URL
  const sseUrl = `/api/system/rag/stream-query?question=${encodeURIComponent(question)}`;
  
  eventSource.value = new EventSource(sseUrl, {
      // 关键！让 EventSource 在跨域请求时携带 Cookie 和认证信息
      withCredentials: true 
  });

  const lastMessage = messages.value.at(-1)!;
  lastMessage.isTyping = false;

  eventSource.value.onmessage = (event) => {
    // 假设 Python 后端发送的结束信号是 'data: [DONE]\n\n'
    // 那么 event.data 就是字符串 '[DONE]'
    const data = event.data;
    if (data === '[DONE]') {
      stopGeneration();
      return;
    }
    
    // 检查是否是错误信息
    try {
      const errorObj = JSON.parse(data);
      if (errorObj.error) {
        lastMessage.content = `**错误**: ${errorObj.error}`;
        stopGeneration();
        return;
      }
    } catch (e) {
      // 不是 JSON，是正常的文本片段，追加到内容中
      // lastMessage.content += data + '\n';
      // scrollToBottom();
    }
    try {
      // 将收到的 JSON 字符串解码为普通字符串
      const textChunk = JSON.parse(data);
      // 确保解码后是字符串类型
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
    if(lastMessage && lastMessage.content === '') {
        // 如果还未收到任何内容就断开，说明是连接错误
        lastMessage.content = '抱歉，连接问答服务失败。请检查网络或联系管理员。';
    }
    // 如果已经有部分内容，则不再覆盖
    stopGeneration();
  };
};

// 结合 marked 和 DOMPurify 的安全渲染函数
const secureRenderMarkdown = (text: string) => {
  const rawHtml = marked(text, { breaks: true, gfm: true }) as string; // 断言为 string
  return DOMPurify.sanitize(rawHtml);
};


const modalVisible = ref(false);
const modalContent = ref<'kb' | 'kg'>('kb');

const modalTitle = computed(() => {
  return modalContent.value === 'kb' ? '知识库文档' : '知识图谱';
});

const showModal = (type: 'kb' | 'kg') => {
  modalContent.value = type;
  modalVisible.value = true;
};
</script>

<style scoped>
@import './literag.scss';
</style>