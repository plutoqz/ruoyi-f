<template>
  <div class="card">
    <h2>1. 数据源管理</h2>
    <div class="data-source-list" v-if="dataSources.length > 0">
      <div class="source-item" v-for="(source, index) in dataSources" :key="source.id">
        <div class="source-info">
          <span class="source-icon">📄</span>
          <span class="source-name">{{ source.name }}</span>
          <span class="source-details">({{ source.recordCount }}条记录)</span>
        </div>
        <button class="btn small danger" @click="removeDataSource(index)">移除</button>
      </div>
    </div>
    <div v-else class="no-data-placeholder">
      <p>请添加数据源以开始构建图谱。</p>
    </div>

    <!-- FIX #1: Disabled state is now controlled by a prop from the parent -->
    <button class="btn btn-add" @click="triggerFileInput" :disabled="isProcessing">
      <span v-if="isProcessing">
        <div class="spinner small-spinner"></div> 处理中...
      </span>
      <span v-else>+ 添加数据源</span>
    </button>

    <input 
      type="file" 
      ref="fileInputRef" 
      @change="handleFileSelected" 
      style="display: none" 
      accept=".zip,.json,.geojson,application/zip,application/json"
      multiple
    />
  </div>
</template>

<script setup>
import { ref, defineEmits, defineProps } from 'vue';

const props = defineProps({
  dataSources: { type: Array, required: true },
  isProcessing: { type: Boolean, default: false } // Controlled by parent
});

const emit = defineEmits(['add-source', 'remove-source']);

const fileInputRef = ref(null);

const triggerFileInput = () => {
  fileInputRef.value.click();
};

const handleFileSelected = (event) => {
  const files = event.target.files;
  if (files && files.length > 0){
    for (const file of files){
      emit('add-source', file);
    }
  }
  event.target.value = '';
  // const file = event.target.files[0];
  // if (file) {
  //   emit('add-source', file);
  // }
  // event.target.value = '';
};

const removeDataSource = (index) => {
  emit('remove-source', index);
};
</script>

<style scoped>
.data-source-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 15px; }
.source-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; background-color: var(--light-gray-color); border-radius: 6px; border: 1px solid var(--border-color); }
.source-info { display: flex; align-items: center; gap: 8px; }
.source-name { font-weight: 600; }
.source-details { font-size: 0.9em; color: var(--dark-gray-color); }
.no-data-placeholder { text-align: center; color: var(--dark-gray-color); margin: 20px 0; }
.btn-add { display: flex; justify-content: center; align-items: center; gap: 8px; }
.spinner.small-spinner { width: 16px; height: 16px; border-width: 2px; margin: 0; }
</style>