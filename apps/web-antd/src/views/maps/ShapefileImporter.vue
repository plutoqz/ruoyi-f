<template>
  <div>
    <button
      @click="triggerFileInput"
      class="group flex items-center p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors duration-300 w-full text-left"
    >
      <i
        class="fi fi-tr-object-ungroup"
        style="font-size: 1.25rem;color: currentColor; width: 12px; height: 26px; display: inline-block; margin-right: 24px; vertical-align: middle;"
      ></i>

      <span class="group-hover:text-blue-500 transition-colors duration-300 text-base md:text-sm" style="vertical-align: middle;">
        SHP
      </span>
    </button>
    <input
      type="file"
      ref="shpFileInputRef"
      @change="handleFileChange"
      accept=".shp/.zip,application/zip,application/x-zip-compressed"
      class="hidden"
    />
    <p v-if="loadingStatus" class="text-xs text-gray-500 mt-1">{{ loadingStatus }}</p>
    <p v-if="errorMessage" class="text-xs text-red-500 mt-1">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { ref, defineEmits } from 'vue';

const shpFileInputRef = ref(null);
const loadingStatus = ref('');
const errorMessage = ref('');

const emit = defineEmits(['shp-loaded', 'shp-error']);

const triggerFileInput = () => {
  errorMessage.value = '';
  loadingStatus.value = '';
  shpFileInputRef.value.click();
};

const handleFileChange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (file.type !== 'application/zip' && file.type !== 'application/x-zip-compressed' && !file.name.toLowerCase().endsWith('.zip')) {
    errorMessage.value = '请上传包含Shapefile的ZIP压缩包。';
    shpFileInputRef.value.value = ''; // Reset file input
    return;
  }

  loadingStatus.value = `正在处理 ${file.name}...`;
  errorMessage.value = '';

  try {
    // **实际的SHP文件解析通常是异步且复杂的**
    // 这里仅做演示，通常你需要一个库 (如 shpjs) 或发送到后端处理
    // 例如，使用shpjs:
    // const arrayBuffer = await file.arrayBuffer();
    // const geojsonData = await shp(arrayBuffer).catch(err => { throw new Error('无法解析SHP文件: ' + err.message) });
    //
    // 为了演示，我们假设解析成功并得到了GeoJSON格式的数据
    // 替换下面的模拟数据为实际的解析结果

    // 模拟异步解析
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 假设解析后的数据结构
    const parsedData = {
      type: "FeatureCollection",
      features: [
        // ... features ...
      ]
    };
    
    // 检查解析后的数据是否有效 (根据你的需求)
    if (!parsedData || !parsedData.features) {
        throw new Error('解析后的SHP数据无效。');
    }

    emit('shp-loaded', {
      name: file.name.replace(/\.zip$/i, ''), // 使用文件名（去除.zip后缀）作为图层名
      data: parsedData, // 这是解析后的GeoJSON数据
      originalFile: file
    });
    loadingStatus.value = `${file.name} 导入成功！`;

  } catch (error) {
    console.error('SHP Import Error:', error);
    errorMessage.value = `导入SHP文件失败: ${error.message}`;
    emit('shp-error', `导入SHP文件失败: ${error.message}`);
  } finally {
    // 清空文件输入，以便可以再次选择相同的文件
    if (shpFileInputRef.value) {
      shpFileInputRef.value.value = '';
    }
    // 可以选择在成功或失败后清除loadingStatus，或者保留成功/失败信息
    // loadingStatus.value = ''; // 例如，在发生错误时清除
  }
};
</script>

<style scoped>
.feather {
  display: inline-block;
  vertical-align: middle;
}
.fi-tr-object-ungroup{}
</style>