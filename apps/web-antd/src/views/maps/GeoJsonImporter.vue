<template>
  <div>
    <button
      @click="triggerFileInput"
      class="group flex items-center p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors duration-300 w-full text-left"
    >
      <i
        class="fi fi-rs-draw-polygon"
        style="font-size: 1.25rem;color: currentColor; width: 16px; height: 28px; display: inline-block; margin-right: 24px; vertical-align: middle;"
      ></i>
      <span class="group-hover:text-blue-500 transition-colors duration-300 text-base md:text-lg" style="vertical-align: middle;">
        矢量导入
      </span>
    </button>
    <input
      type="file"
      ref="geojsonFileInputRef"
      @change="handleFileChange"
      accept=".geojson,application/json"
      class="hidden"
    />
    <p v-if="loading" class="text-sm text-gray-500 mt-1">正在加载...</p>
    <p v-if="error" class="text-sm text-red-500 mt-1">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, defineEmits } from 'vue';

// 定义组件可以触发的事件
const emit = defineEmits(['geojson-loaded', 'geojson-error']);

// ref 用于访问隐藏的文件输入框
const geojsonFileInputRef = ref(null);
const loading = ref(false);
const error = ref('');

// 方法：触发文件输入框的点击事件
const triggerFileInput = () => {
  error.value = ''; // 清除之前的错误信息
  geojsonFileInputRef.value.click();
};

// 方法：处理文件选择变化
const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (!file) {
    console.log('没有选择文件。');
    return;
  }

  // 检查文件类型
  if (file.type !== 'application/json' && !file.name.endsWith('.geojson')) {
    const errMsg = '请选择一个 GeoJSON 或 JSON 文件。';
    console.error(errMsg);
    error.value = errMsg;
    // alert(errMsg); // 避免使用 alert
    event.target.value = ''; // 清空，以便再次选择同文件
    emit('geojson-error', errMsg);
    return;
  }

  loading.value = true;
  error.value = '';
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const geojsonData = JSON.parse(e.target.result);
      console.log('GeoJSON 数据在子组件解析成功:', geojsonData);
      // 触发事件，将解析后的数据传递给父组件
      emit('geojson-loaded', geojsonData);
    } catch (err) {
      const errMsg = '无法解析文件内容，请确保它是有效的 GeoJSON/JSON 格式。';
      console.error('解析 GeoJSON 数据失败:', err);
      error.value = errMsg;
      // alert(errMsg);
      emit('geojson-error', errMsg);
    } finally {
      loading.value = false;
      // 清空文件输入框的值，以便用户可以选择同一个文件再次触发 change 事件
      event.target.value = '';
    }
  };

  reader.onerror = (e) => {
    const errMsg = '读取文件失败。';
    console.error('读取文件失败:', e);
    error.value = errMsg;
    // alert(errMsg);
    loading.value = false;
    event.target.value = '';
    emit('geojson-error', errMsg);
  };

  reader.readAsText(file); // 读取文件内容为文本
};
</script>

<style scoped>

</style>