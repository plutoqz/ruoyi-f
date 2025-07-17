<template>
  <div class="card">
    <h2>1. 矢量数据上传</h2>
    <div class="upload-box" @dragover.prevent @drop="handleDrop">
      <div v-if="!processing && !file" class="upload-placeholder">
        <i class="upload-icon">📁</i>
        <p>拖放 <strong>.zip (SHP)</strong>, <strong>.json</strong> 或 <strong>.geojson</strong> 文件</p>
        <p>或</p>
        <button class="btn primary" @click="triggerFileInput">选择文件</button>
      </div>
      <div v-else-if="processing" class="upload-placeholder">
        <div class="spinner"></div>
        <p>{{ processingStatusMessage }}</p>
      </div>
      <div v-else class="file-info">
        <i class="file-icon">✔️</i>
        <p><strong>{{ file.name }}</strong></p>
        <p class="file-size">数据已加载 ({{ recordCount }}条记录, {{ fieldCount }}个字段)</p>
        <button class="btn small danger" @click="removeFile">移除文件</button>
      </div>
      <input 
        type="file" 
        ref="fileInputRef" 
        @change="handleFileChange" 
        style="display: none" 
        accept=".zip,.json,.geojson,application/zip,application/json"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, defineEmits } from 'vue';

const emit = defineEmits(['file-processed', 'file-removed']);

const fileInputRef = ref(null);
const file = ref(null);
const recordCount = ref(0);
const fieldCount = ref(0);
const processing = ref(false); // Renamed from 'uploading'
const processingStatusMessage = ref('');

// Backend API URL for SHP file processing
const API_BASE_URL = 'http://localhost:8080'; // Your Spring Boot App URL

let pollingInterval = null;

const triggerFileInput = () => {
  fileInputRef.value.click();
};

const handleDrop = (event) => {
  event.preventDefault();
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
};

const handleFileChange = (event) => {
  const files = event.target.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
};

/**
 * Determines how to process the file based on its extension.
 */
const processFile = (selectedFile) => {
  const fileName = selectedFile.name.toLowerCase();
  if (fileName.endsWith('.zip')) {
    processZipFileWithBackend(selectedFile);
  } else if (fileName.endsWith('.json') || fileName.endsWith('.geojson')) {
    processJsonFileInFrontend(selectedFile);
  } else {
    alert("不支持的文件类型。请上传 .zip, .json, 或 .geojson 文件。");
  }
};

// --- Backend Processing for .zip files ---

const processZipFileWithBackend = async (selectedFile) => {
  processing.value = true;
  processingStatusMessage.value = '正在上传文件...';
  
  const formData = new FormData();
  formData.append('file', selectedFile);

  try {
    const uploadResponse = await fetch(`/api/files/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorBody = await uploadResponse.json();
      throw new Error(errorBody.error || `Upload failed with status: ${uploadResponse.status}`);
    }

    const { taskId } = await uploadResponse.json();
    processingStatusMessage.value = '文件上传成功，后端正在解析...';
    pollForStatus(taskId, selectedFile.name);

  } catch (error) {
    handleError('文件上传失败', error);
  }
};

const pollForStatus = (taskId, originalFileName) => {
  pollingInterval = setInterval(async () => {
    try {
      const statusResponse = await fetch(`/api/files/status/${taskId}`);
      if (!statusResponse.ok) throw new Error(`Status check failed: ${statusResponse.status}`);
      
      const { status, error } = await statusResponse.json();

      if (status === 'COMPLETED') {
        clearInterval(pollingInterval);
        processingStatusMessage.value = '解析完成，正在获取数据...';
        fetchData(taskId, originalFileName);
      } else if (status === 'FAILED') {
        clearInterval(pollingInterval);
        throw new Error(error || '后端解析失败。');
      }
    } catch (error) {
      clearInterval(pollingInterval);
      handleError('获取处理状态失败', error);
    }
  }, 2000);
};

const fetchData = async (taskId, originalFileName) => {
  try {
    const dataResponse = await fetch(`/api/files/data/${taskId}`);
    if (!dataResponse.ok) throw new Error(`Failed to fetch data: ${dataResponse.status}`);
    
    const dataRecords = await dataResponse.json();
    handleExtractedData(dataRecords, originalFileName);

  } catch (error) {
    handleError('获取解析数据失败', error);
  }
};

// --- Frontend Processing for .json/.geojson files ---

const processJsonFileInFrontend = (selectedFile) => {
  processing.value = true;
  processingStatusMessage.value = '正在前端解析文件...';
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      // Add a small delay to show the processing message, improving UX
      setTimeout(() => {
        const parsedData = JSON.parse(e.target.result);
        let features = [];

        if (Array.isArray(parsedData)) {
          features = parsedData;
        } else if (parsedData.type === 'FeatureCollection' && Array.isArray(parsedData.features)) {
          features = parsedData.features.map(f => f.properties);
        } else if (typeof parsedData === 'object' && parsedData !== null) {
          const key = Object.keys(parsedData).find(k => Array.isArray(parsedData[k]));
          if (key) features = parsedData[key];
        }
        
        handleExtractedData(features, selectedFile.name);
      }, 200);
    } catch (error) {
      handleError("解析JSON文件失败", error);
    }
  };
  reader.onerror = (e) => handleError("读取文件失败", e);
  reader.readAsText(selectedFile);
};


// --- Common Logic ---

/**
 * Processes the final array of data records, regardless of the source.
 */
const handleExtractedData = (dataRecords, originalFileName) => {
  if (!dataRecords || dataRecords.length === 0) {
    handleError("处理失败", new Error("无法在文件中找到有效的数据记录。"));
    return;
  }
  
  const firstRecord = dataRecords[0];
  if (typeof firstRecord !== 'object' || firstRecord === null) {
      handleError("处理失败", new Error("数据记录必须是对象格式。"));
      return;
  }
  
  const attributes = Object.keys(firstRecord);
  
  file.value = { name: originalFileName };
  recordCount.value = dataRecords.length;
  fieldCount.value = attributes.length;
  
  emit('file-processed', { jsonData: dataRecords, attributeFields: attributes });
  processing.value = false;
};

const handleError = (message, error) => {
    console.error(`${message}:`, error);
    alert(`${message}: ${error.message}`);
    _reset();
};

const _reset = () => {
    clearInterval(pollingInterval);
    file.value = null;
    processing.value = false;
    processingStatusMessage.value = '';
    recordCount.value = 0;
    fieldCount.value = 0;
    if (fileInputRef.value) {
        fileInputRef.value.value = '';
    }
};

const removeFile = () => {
  _reset();
  emit('file-removed');
};
</script>

<style scoped>
/* Styles from previous steps are sufficient */
</style>