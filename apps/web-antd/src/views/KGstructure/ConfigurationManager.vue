<template>
  <div class="card">
    <!-- <h2>1. 配置管理</h2> -->
    <div class="controls">
      <button class="btn btn-add" @click="exportConfig">
        <i class="icon-export"></i> 导出定义
      </button>
      <button class="btn btn-add" @click="triggerImport">
        <i class="icon-import"></i> 导入定义
      </button>
      <!-- 隐藏的文件输入框，通过JS触发 -->
      <input 
        ref="fileInput" 
        type="file" 
        accept=".json" 
        style="display: none" 
        @change="handleFileImport"
      >
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';

const props = defineProps({
  nodeDefinitions: {
    type: Array,
    required: true
  },
  relationshipDefinitions: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['import-config']);

const fileInput = ref(null);

/**
 * 导出配置到 JSON 文件
 */
const exportConfig = () => {
  // 1. 准备要导出的数据对象
  const configToExport = {
    nodeDefinitions: props.nodeDefinitions,
    relationshipDefinitions: props.relationshipDefinitions
  };

  // 2. 将对象转换为格式化的JSON字符串
  const jsonString = JSON.stringify(configToExport, null, 2);

  // 3. 创建一个Blob对象
  const blob = new Blob([jsonString], { type: 'application/json' });

  // 4. 创建一个临时的URL指向该Blob
  const url = URL.createObjectURL(blob);

  // 5. 创建一个隐藏的a标签来触发下载
  const a = document.createElement('a');
  a.href = url;
  a.download = `kg-generator-config-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();

  // 6. 清理：移除a标签并释放URL
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('配置已导出');
};

/**
 * 触发隐藏的文件输入框
 */
const triggerImport = () => {
  fileInput.value.click();
};

/**
 * 处理文件选择事件
 * @param {Event} event
 */
const handleFileImport = (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const importedConfig = JSON.parse(e.target.result);

      // 1. 验证导入的数据结构是否正确
      if (!Array.isArray(importedConfig.nodeDefinitions) || !Array.isArray(importedConfig.relationshipDefinitions)) {
        throw new Error('无效的配置文件格式。必须包含 nodeDefinitions 和 relationshipDefinitions 数组。');
      }

      // 2. 触发事件，将解析后的配置数据传递给父组件
      emit('import-config', importedConfig);
      console.log('配置导入成功！');

    } catch (error) {
      console.error('导入配置失败:', error);
      alert(`导入失败: ${error.message}`);
    } finally {
      // 重置文件输入框，以便可以再次选择相同的文件
      event.target.value = null;
    }
  };

  reader.onerror = () => {
    alert('读取文件时发生错误。');
  };

  reader.readAsText(file);
};

</script>

<style scoped>
.controls {
  display: flex;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

/* 简单的图标样式，你可以用自己的图标库替换 */
.icon-export::before {
  content: '↑'; /* 简化的下载图标 */
  font-weight: bold;
}
.icon-import::before {
  content: '↓'; /* 简化的上传图标 */
  font-weight: bold;
}
</style>