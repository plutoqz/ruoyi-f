<template>
  <div class="card">
    <h2>1. 矢量数据上传</h2>
    <div class="upload-box" @dragover.prevent @drop="handleDrop">
      <!-- 初始状态 -->
      <div v-if="!processing && processedFiles.length === 0" class="upload-placeholder">
        <i class="upload-icon">📁</i>
        <p>拖放 <strong>.zip (SHP)</strong>, <strong>.json</strong> 或 <strong>.geojson</strong> 文件</p>
        <p>或</p>
        <button class="btn primary" @click="triggerFileInput">选择文件</button>
      </div>
      <!-- 处理中状态 -->
      <div v-else-if="processing" class="upload-placeholder">
        <div class="spinner"></div>
        <p>{{ processingStatusMessage }}</p>
      </div>
      <!-- 文件加载完成状态 -->
      <div v-else class="file-info">
        <i class="file-icon">✔️</i>
        <p><strong>{{ processedFiles.length }} 个文件已加载</strong></p>
        <p class="file-size">总计 {{ totalRecordCount }} 条记录, {{ totalFieldCount }} 个字段</p>
        <button class="btn small danger" @click="removeAllFiles">移除所有文件</button>
      </div>
      <!-- 文件选择输入框 (隐藏) -->
      <!-- <input 
        type="file" 
        ref="fileInputRef" 
        @change="handleFileChange" 
        style="display: none" 
        accept=".zip,.json,.geojson,application/zip,application/json"
        multiple
      /> -->
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineEmits, onBeforeUnmount } from 'vue';

const emit = defineEmits(['file-processed', 'file-removed']);

const fileInputRef = ref(null);
const processedFiles = ref([]); // 统一存储所有已成功处理的文件信息和数据
const processing = ref(false);
const processingStatusMessage = ref('');

let pollingIntervals = []; // 存储所有轮询的计时器

// 计算属性，用于显示汇总信息
const totalRecordCount = computed(() => {
    return processedFiles.value.reduce((sum, file) => sum + file.recordCount, 0);
});
const totalFieldCount = computed(() => {
    if (processedFiles.value.length === 0) return 0;
    // 假设所有文件的字段结构相似，取第一个的字段数
    return processedFiles.value[0].fieldCount;
});


const triggerFileInput = () => {
  fileInputRef.value.click();
};

const handleDrop = (event) => {
  event.preventDefault();
  processFiles(event.dataTransfer.files);
};

const handleFileChange = (event) => {
  processFiles(event.target.files);
  // 清空 input 的值，确保下次选择相同文件也能触发 change 事件
  event.target.value = '';
};

// 统一处理所有传入的文件
const processFiles = (selectedFiles) => {
  if (selectedFiles.length === 0) return;
  
  const filesToProcess = Array.from(selectedFiles);
  const zipFiles = filesToProcess.filter(f => f.name.toLowerCase().endsWith('.zip'));
  const jsonFiles = filesToProcess.filter(f => f.name.toLowerCase().endsWith('.json') || f.name.toLowerCase().endsWith('.geojson'));

  // 重置状态，开始新的上传流程
  _reset();
  processing.value = true;

  const allPromises = [];

  if (zipFiles.length > 0) {
    allPromises.push(processZipFilesWithBackend(zipFiles));
  }
  if (jsonFiles.length > 0) {
    allPromises.push(processJsonFilesInFrontend(jsonFiles));
  }

  // 等待所有类型的上传和处理都结束后，进行最终的数据汇总
  Promise.all(allPromises).then(() => {
    aggregateAndEmitFinalData();
  }).catch(error => {
    handleError("处理文件时发生未知错误", error);
  });
};

// --- 后端处理 .zip 文件 ---
const processZipFilesWithBackend = (selectedFiles) => {
  return new Promise(async (resolve, reject) => {
    processingStatusMessage.value = `正在上传 ${selectedFiles.length} 个 ZIP 文件...`;
    
    const formData = new FormData();
    selectedFiles.forEach(file => formData.append('files', file));

    try {
      const uploadResponse = await fetch(`/api/files/upload`, { method: 'POST', body: formData });
      if (!uploadResponse.ok) {
        const errorBody = await uploadResponse.json();
        throw new Error(errorBody.error || `上传失败，状态码: ${uploadResponse.status}`);
      }

      const tasks = await uploadResponse.json();
      processingStatusMessage.value = `文件上传成功，后端正在解析 ${tasks.length} 个任务...`;
      
      const tasksWithStatus = tasks.map(task => ({ ...task, status: 'PROCESSING', data: null }));
      startPollingForMultipleTasks(tasksWithStatus, resolve); // 传入 resolve 回调

    } catch (error) {
      handleError('文件上传失败', error);
      reject(error);
    }
  });
};

// 轮询多个任务的状态
const startPollingForMultipleTasks = (tasks, onAllDone) => {
  let activeTasks = [...tasks];

  const interval = setInterval(async () => {
    if (activeTasks.length === 0) {
      clearInterval(interval);
      // 将处理结果存入 processedFiles
      tasks.forEach(task => {
        if (task.status === 'COMPLETED' && task.data) {
          addProcessedFile(task.data.featureDataList || task.data, task.fileName);
        } else {
          console.error(`处理文件 ${task.fileName} 失败:`, task.error);
        }
      });
      onAllDone(); // 通知 Promise 完成
      return;
    }

    // 并发检查所有任务状态
    const statusPromises = activeTasks.map(async (task) => {
      try {
        const res = await fetch(`/api/files/status/${task.taskId}`);
        if (!res.ok) throw new Error(`状态检查失败: ${res.status}`);
        const { status, error } = await res.json();
        task.status = status;
        if (status === 'FAILED') task.error = error || '后端解析失败。';
      } catch (error) {
        task.status = 'FAILED';
        task.error = error.message;
      }
    });

    await Promise.all(statusPromises);

    const completedTasks = activeTasks.filter(t => t.status === 'COMPLETED');
    if (completedTasks.length > 0) {
      await Promise.all(completedTasks.map(fetchDataForTask));
    }

    // 从 activeTasks 列表中移除已完成或失败的任务
    activeTasks = activeTasks.filter(t => t.status === 'PROCESSING');
    const doneCount = tasks.length - activeTasks.length;
    processingStatusMessage.value = `解析中... ${doneCount}/${tasks.length} 完成。`;

  }, 2000);

  pollingIntervals.push(interval);
};

const fetchDataForTask = async (task) => {
  try {
    const res = await fetch(`/api/files/data/${task.taskId}`);
    if (!res.ok) throw new Error(`获取数据失败: ${res.status}`);
    task.data = await res.json();
  } catch (error) {
    task.status = 'FAILED';
    task.error = error.message;
  }
};

// --- 前端处理 .json/.geojson 文件 ---
const processJsonFilesInFrontend = (selectedFiles) => {
  return new Promise((resolve) => {
    processingStatusMessage.value = `正在前端解析 ${selectedFiles.length} 个 JSON 文件...`;
    const readPromises = selectedFiles.map(file => {
      return new Promise((fileResolve, fileReject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target.result);
            let features = [];
            if (Array.isArray(parsed)) {
                features = parsed;
            } else if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
                features = parsed.features.map(f => f.properties);
            }
            addProcessedFile(features, file.name);
            fileResolve();
          } catch (error) {
            console.error(`解析文件 ${file.name} 失败:`, error);
            fileReject(error);
          }
        };
        reader.onerror = (e) => fileReject(e);
        reader.readAsText(file);
      });
    });
    // 即使有文件解析失败，也算整个流程完成
    Promise.allSettled(readPromises).then(() => resolve());
  });
};

// --- 通用逻辑 ---

// 将成功处理的文件数据添加到 processedFiles 数组中
const addProcessedFile = (dataRecords, fileName) => {
  if (!dataRecords || dataRecords.length === 0) return;
  
  // 统一数据结构，兼容 SHP 的 attributes 嵌套和普通 JSON
  const records = dataRecords.map(item => item.attributes || item);
  const firstRecord = records[0];
  if (typeof firstRecord !== 'object' || firstRecord === null) return;
  
  const attributes = Object.keys(firstRecord);
  processedFiles.value.push({
    name: fileName,
    recordCount: records.length,
    fieldCount: attributes.length,
    jsonData: records,
    attributeFields: attributes
  });
};

// 汇总所有成功的数据并向父组件发送事件
const aggregateAndEmitFinalData = () => {
  if (processedFiles.value.length === 0) {
    handleError("所有文件处理失败", new Error("请检查文件内容或联系管理员。"));
    return;
  }

  const allJsonData = [];
  const allFields = new Set();
  processedFiles.value.forEach(file => {
    allJsonData.push(...file.jsonData);
    file.attributeFields.forEach(field => allFields.add(field));
  });

  emit('file-processed', {
    jsonData: allJsonData,
    attributeFields: Array.from(allFields)
  });
  
  processing.value = false;
};

const handleError = (message, error) => {
  console.error(`${message}:`, error);
  alert(`${message}: ${error.message}`);
  _reset();
};

const clearAllIntervals = () => {
  pollingIntervals.forEach(clearInterval);
  pollingIntervals = [];
};

const _reset = () => {
  clearAllIntervals();
  processedFiles.value = [];
  processing.value = false;
  processingStatusMessage.value = '';
};

const removeAllFiles = () => {
  _reset();
  emit('file-removed');
};

onBeforeUnmount(clearAllIntervals);
</script>

<style scoped>
/* 样式保持不变 */
</style>
