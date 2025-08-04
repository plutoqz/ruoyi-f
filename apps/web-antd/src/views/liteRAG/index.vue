<template>
  <div class="rag-page-container p-4">
    <a-card title="智能问答助手">
      <div class="chat-container">
        <!-- 对话展示区域 -->
        <div class="message-list" ref="messageListRef">
          <div v-for="(message, index) in messages" :key="index" :class="['message-item', message.role]">
            <div class="avatar">
              {{ message.role === 'user' ? '我' : '答' }}
            </div>
            <div class="message-content">
              <!-- 使用 v-html 来渲染 Markdown，需要注意 XSS 风险，但对于内部系统通常可接受 -->
              <!-- 如果答案是纯文本，直接用 {{ message.content }} 即可 -->
              <div v-if="message.isTyping">
                <a-spin />
              </div>
              <div v-else v-html="renderMarkdown(message.content)"></div>
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
          <a-button type="primary" @click="sendMessage" :loading="isLoading" class="ml-2">
            发送
          </a-button>
        </div>
      </div>
    </a-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, nextTick } from 'vue';
import { Card, Input, Button, Spin, message as AntMessage } from 'ant-design-vue';
import { queryRAG } from './rag'; // 引入我们刚刚创建的 API 函数
import { marked } from 'marked'; // 引入 marked 库用于渲染 Markdown

// 如果你的项目没有安装 marked，请运行：pnpm add marked @types/marked -w
// 或者 yarn add marked @types/marked / npm install marked @types/marked

const ATextarea = Input.TextArea;

// 对话消息列表
interface Message {
  role: 'user' | 'assistant';
  content: string;
  isTyping?: boolean;
}
const messages = ref<Message[]>([
  { role: 'assistant', content: '你好！我是对话智能体，有什么可以帮助你的吗？' }
]);

const userInput = ref('');
const isLoading = ref(false);
const messageListRef = ref<HTMLElement | null>(null);

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    const el = messageListRef.value;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  });
};

// 发送消息
const sendMessage = async () => {
  const question = userInput.value.trim();
  if (!question || isLoading.value) return;

  // 1. 将用户消息添加到列表
  messages.value.push({ role: 'user', content: question });
  userInput.value = '';
  scrollToBottom();
  
  // 2. 添加一个“正在输入”的占位符
  messages.value.push({ role: 'assistant', content: '', isTyping: true });
  isLoading.value = true;
  scrollToBottom();

  try {
    // 3. 调用 API 获取答案
    const answer = await queryRAG(question);
    console.log('【调试】收到的原始后端响应:', answer);
    // 4. 更新最后一条消息（“正在输入”的占位符）
    const lastMessage = messages.value[messages.value.length - 1];

    if (lastMessage) { // <--- 在这里添加检查
      lastMessage.content = answer;
      lastMessage.isTyping = false;
    }

    // lastMessage.content = answer;
    // lastMessage.isTyping = false;

  } catch (error) {
    // 5. 处理错误情况
    const lastMessage = messages.value[messages.value.length - 1];
    if (lastMessage) {
      lastMessage.content = '抱歉，回答出错了，请稍后再试。';
      lastMessage.isTyping = false;
    }
    AntMessage.error((error as Error).message || '获取回答失败');
  } finally {
    isLoading.value = false;
    scrollToBottom();
  }
};

// 渲染 Markdown
const renderMarkdown = (text: string) => {
  // 配置 marked 以处理换行符等
  return marked(text, { breaks: true, gfm: true });
};

</script>

<style scoped>
@import './literag.scss';
</style>