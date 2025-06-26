<template>
  <div>
    <button
      @click="triggerFileInput"
      class="group flex items-center p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors duration-300 w-full text-left"
    >
      <i
        class="fi fi-rs-draw-polygon"
        style="font-size: 1rem;color: currentColor; width: 12px; height: 22px; display: inline-block; margin-right: 24px; vertical-align: middle;"
      ></i>
      
      <span class="group-hover:text-blue-500 transition-colors duration-300 text-base md:text-sm" style="vertical-align: middle;">
        JSON
      </span>
    </button>
    <input
      type="file"
      ref="geojsonFileInputRef"
      @change="handleFileChange"
      accept=".geojson,application/json"
      class="hidden"
    />
    <p v-if="loadingStatus" class="text-sm text-gray-500 mt-1">{{ loadingStatus }}</p>
    <p v-if="errorMessage" class="text-sm text-red-500 mt-1">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { ref, defineEmits } from 'vue';

const emit = defineEmits(['geojson-loaded', 'geojson-error','right-sidebar']);
const geojsonFileInputRef = ref(null);
const loadingStatus = ref('');
const errorMessage = ref('');

const triggerFileInput = () => {
  errorMessage.value = '';
  loadingStatus.value = '';
  if (geojsonFileInputRef.value) {
    geojsonFileInputRef.value.click();
  }
};

const handleFileChange = (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    console.log('GeoJsonImporter: No file selected.');
    return;
  }

  errorMessage.value = '';
  loadingStatus.value = `正在读取文件: ${file.name}...`;

  if (file.type !== 'application/json' && !file.name.toLowerCase().endsWith('.geojson') && !file.name.toLowerCase().endsWith('.json')) {
    const typeErrorMsg = '请选择一个有效的 GeoJSON (.geojson) 或 JSON (.json) 文件。';
    console.error('GeoJsonImporter: Invalid file type -', file.type, file.name);
    errorMessage.value = typeErrorMsg;
    loadingStatus.value = '';
    emit('geojson-error', typeErrorMsg);
    if (event.target) event.target.value = '';
    return;
  }

  const capturedFileName = file.name; // Capture file name immediately
  const reader = new FileReader();

  reader.onload = (e_reader) => {
    loadingStatus.value = '正在解析文件内容...';
    const fileContentAsString = e_reader.target.result;

    console.log('GeoJsonImporter: FileReader onload triggered.');
    console.log('GeoJsonImporter: File content string length:', fileContentAsString ? fileContentAsString.length : 'N/A');
    // console.log('GeoJsonImporter: File content (first 500 chars):', fileContentAsString ? fileContentAsString.substring(0, 500) : 'N/A');

    try {
      const geojsonData = JSON.parse(fileContentAsString);
      console.log('GeoJsonImporter: JSON.parse successful for file:', capturedFileName);
      // console.log('GeoJsonImporter: Parsed GeoJSON (brief):', JSON.stringify(geojsonData).substring(0, 200) + "...");

      const payload = { name: capturedFileName, data: geojsonData };
      console.log('GeoJsonImporter: Preparing to emit "geojson-loaded" with payload:', {name: payload.name, dataType: typeof payload.data});

      emit('geojson-loaded', payload); // This is the critical line (approx line 83 in your log)
      
      console.log('GeoJsonImporter: Successfully emitted "geojson-loaded" for:', capturedFileName);
      // loadingStatus.value = `文件 "${capturedFileName}" 加载成功!`;

    } catch (err) {
      // This catch block is being entered if an error occurs during JSON.parse OR during/after emit.
      console.error('GeoJsonImporter: Error caught in reader.onload try-catch block for file:', capturedFileName);
      console.error('GeoJsonImporter: Error name:', err.name);
      console.error('GeoJsonImporter: Error message:', err.message);
      console.error('GeoJsonImporter: Error stack:', err.stack);
      
      const parseErrorMsg = `无法解析文件 "${capturedFileName}" 的内容。请确保它是有效的 GeoJSON/JSON 格式。`;
      errorMessage.value = parseErrorMsg;
      loadingStatus.value = '';
      emit('geojson-error', parseErrorMsg);
    } finally {
      if (event.target) {
        event.target.value = ''; // Clear file input to allow re-selection of the same file
      }
      loadingStatus.value = ''; // Clear loading status or set to final status in try/catch
    }
  };

  reader.onerror = (e_reader_error) => {
    console.error('GeoJsonImporter: FileReader.onerror triggered for file:', capturedFileName, e_reader_error);
    const readErrorMsg = `读取文件 "${capturedFileName}" 失败。`;
    errorMessage.value = readErrorMsg;
    loadingStatus.value = '';
    emit('geojson-error', readErrorMsg);
    if (event.target) event.target.value = '';
  };

  reader.readAsText(file); // Read file as text
  emit('right-sidebar',ture);
};
</script>

<style scoped>
/* Styles from previous Sidebar.vue for consistency if needed */
.fi-rs-draw-polygon {
  /* Ensure icon styles are available */
}
</style>