<template>
  <div class="kb-container">
    <div class="kb-card">
      <!-- 卡片标题 -->
      <div class="kb-card-head">知识库构建与管理</div>

      <!-- 卡片主体 -->
      <div class="kb-card-body">
        <!-- 步骤条 -->
        <div class="kb-steps">
          <div
            class="kb-step"
            :class="{ active: currentStep >= 0 }"
          >
            上传文档
          </div>
          <div
            class="kb-step"
            :class="{ active: currentStep >= 1 }"
          >
            构建中
          </div>
          <div
            class="kb-step"
            :class="{ active: currentStep >= 2 }"
          >
            预览与确认
          </div>
        </div>

        <!-- 步骤内容 -->
        <div class="kb-step-content">
          <!-- 步骤一：上传 -->
          <div v-if="currentStep === 0">
            <!-- 关键：保留 a-upload-dragger 并加自定义类 -->
            <a-upload-dragger
              v-model:fileList="fileList"
              name="files"
              :multiple="true"
              :before-upload="() => false"
              accept=".txt,.md,.pdf"
              class="kb-upload"
            >
              <p class="ant-upload-drag-icon"><inbox-outlined /></p>
              <p class="ant-upload-text">点击或拖拽文件到此区域进行上传</p>
              <p class="ant-upload-hint">支持多个 .txt, .md, .pdf 等格式的文本文件。</p>
            </a-upload-dragger>
            <div class="kb-actions">
              <a-button
                type="primary"
                class="kb-btn primary"
                :disabled="fileList.length === 0"
                :loading="isUploading"
                @click="handleUpload"
              >
                开始构建
              </a-button>
              <a-button class="kb-btn secondary" @click="handleSkip">
                使用现有知识库
              </a-button>
            </div>
            
          </div>

          <!-- 步骤二：构建中 -->
          <div v-if="currentStep === 1" class="kb-build-progress">
            <!-- 用原生 circle 展示进度 -->
            <div
              class="kb-progress-circle"
              :data-percent="buildProgress.percent"
              :style="{
                background: `conic-gradient(#1677ff ${buildProgress.percent}%, #e5e7eb 0%)`
              }"
            ></div>
            <p class="kb-status-msg">{{ buildProgress.message }}</p>
            <button class="kb-btn secondary kb-stop-btn" @click="stopPolling">
              停止监控
            </button>
          </div>

          <!-- 步骤三：预览 -->
          <div v-if="currentStep === 2" class="kb-preview">
          <div class="kb-footer-actions">
              <button class="kb-btn secondary" @click="handleAbort">
                取消构建
              </button>
              <button
                class="kb-btn primary"
                :loading="isCommitting"
                @click="handleCommit"
              >
                确认应用
              </button>
            </div>
            <!-- 知识图谱占位 -->
            <div class="kb-kg-view">
              <kgview
                :visible="currentStep === 2"
                :graph-data-loader="loadPreviewData"
              />
            </div>

            
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { Steps, Upload, Button, Progress, Alert, Space, message, type UploadFile } from 'ant-design-vue';
// import { InboxOutlined } from '@ant-design/icons-vue';
// 确保这些 API 函数的路径和实现是正确的
import {
  startKnowledgeBuild,
  commitKnowledgeBuild,
  abortKnowledgeBuild,
  getBuildPreviewGraph,
  // 我们需要一个新的 API 函数来获取状态
  getBuildStatus, // <--- 假设这个函数在 rag.ts 中定义
} from './rag';
import kgview from './kgview.vue';

const emit = defineEmits(['build-completed', 'skip-build']);

const AStep = Steps.Step;
const AUploadDragger = Upload.Dragger;

// --- 状态定义 ---
const currentStep = ref(0);
const fileList = ref<UploadFile[]>([]);
const isUploading = ref(false);
const isCommitting = ref(false);
const buildProgress = ref({ percent: 0, message: '等待开始...' });
const taskId = ref<string | null>(null);

// --- 轮询逻辑 ---
let pollingInterval = ref<NodeJS.Timeout | null>(null);

const startPolling = (currentTaskId: string) => {
  // 先清除可能存在的旧定时器
  stopPolling();

  pollingInterval.value = setInterval(async () => {
    try {
      const status = await getBuildStatus(currentTaskId);
      
      buildProgress.value.percent = Math.round(status.progress * 100);
      buildProgress.value.message = status.message;

      if (status.status === 'completed') {
        currentStep.value = 2;
        stopPolling(); // 任务完成，停止轮询
      } else if (status.status === 'failed') {
        message.error(`构建失败: ${status.message}`);
        stopPolling();
        // 可以在这里选择重置界面或让用户手动重置
        // reset(); 
      }
    } catch (error) {
      console.error('轮询状态失败:', error);
      message.error('无法获取构建状态，已停止监控。');
      stopPolling();
    }
  }, 2000); // 每 2 秒查询一次状态
};

const stopPolling = () => {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
    pollingInterval.value = null;
    console.log('轮询已停止');
  }
};

// --- 事件处理 ---
const handleUpload = async () => {
  isUploading.value = true;
  try {
    const filesToUpload = fileList.value.map(f => f.originFileObj as File);
    const newTaskId = await startKnowledgeBuild(filesToUpload);
    taskId.value = newTaskId;
    currentStep.value = 1;
    // 启动 HTTP 轮询
    startPolling(newTaskId);
  } catch (error) {
    message.error('上传并开始构建失败，请重试');
    console.error(error);
  } finally {
    isUploading.value = false;
  }
};

const handleCommit = async () => {
  if (!taskId.value) return;
  isCommitting.value = true;
  try {
    await commitKnowledgeBuild(taskId.value);
    message.success('知识库已成功应用更新！');
    // 2. 构建成功并应用后，触发 'build-completed' 事件
    emit('build-completed'); 
  } catch (error) {
    message.error('应用更新失败');
  } finally {
    isCommitting.value = false;
  }
};

const handleAbort = async () => {
  if (taskId.value) {
    await abortKnowledgeBuild(taskId.value);
    message.info('构建任务已取消');
  }
  reset();
};

// --- 其他函数 ---
const reset = () => {
  currentStep.value = 0;
  fileList.value = [];
  taskId.value = null;
  buildProgress.value = { percent: 0, message: '等待开始...' };
  stopPolling();
};

const loadPreviewData = () => {
     if (!taskId.value) {
        // 如果没有 taskId，返回一个失败的 Promise
        return Promise.reject("任务ID无效，无法加载预览");
    }
    // 调用新的、需要 taskId 的预览接口
    return getBuildPreviewGraph(taskId.value); 
};

// 组件销毁时，确保清除定时器，防止内存泄漏
onUnmounted(() => {
  stopPolling();
});


const handleSkip = () => {
    // 3. 用户点击“跳过”时，触发 'skip-build' 事件
    emit('skip-build');
}

</script>

<style scoped>
/* 样式部分保持不变 */
@import './builder.scss';
</style>