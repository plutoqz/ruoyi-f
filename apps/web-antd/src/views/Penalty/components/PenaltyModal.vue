<template>
  <!-- 模态框的遮罩层 -->
  <div v-if="isVisible" class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[2000]" @click.self="$emit('close')">
    <!-- 模态框主体 -->
    <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[85vh] flex flex-col">
      <!-- 头部 -->
      <div class="flex justify-between items-center mb-4 pb-3 border-b">
        <h2 class="text-xl font-bold text-gray-800">生成处罚方案</h2>
        <button @click="$emit('close')" class="text-gray-500 hover:text-gray-800 text-2xl leading-none">&times;</button>
      </div>

      <!-- 内容区 -->
      <div class="flex-grow overflow-y-auto pr-2 custom-scrollbar">
        <!-- 批量模式下的图层选择 -->
        <div v-if="mode === 'batch'" class="mb-4">
          <h3 class="font-semibold mb-2 text-gray-700">选择要处罚的图层:</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto border p-3 rounded-md bg-gray-50">
            <label v-for="layer in selectableLayers" :key="layer.id" class="flex items-center cursor-pointer hover:bg-gray-100 p-1 rounded">
              <input type="checkbox" :value="layer.id" v-model="selectedLayerIds" class="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
              <span class="text-gray-800">{{ layer.name }} ({{ (layer.area || 0).toFixed(2) }} m²)</span>
            </label>
          </div>
        </div>

        <!-- 违规类型选择 -->
        <div class="mb-4">
          <label for="issue-type" class="block font-semibold mb-2 text-gray-700">选择违规类型:</label>
          <select id="issue-type" v-model="selectedIssue" class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="非法占用土地(未批先建)">非法占用土地(未批先建)</option>
            <option value="擅自将农用地改为建设用地">擅自将农用地改为建设用地</option>
            <option value="非法转让土地">非法转让土地</option>
            <option value="农村村民非法占地建住宅">农村村民非法占地建住宅</option>
            <option value="拒不履行土地复垦义务">拒不履行土地复垦义务</option>
            <option value="临时用地上建永久建筑">临时用地上建永久建筑</option>
            <option value="临时用地逾期未恢复">临时用地逾期未恢复</option>
          </select>
        </div>
        
        <!-- 土地类型选择 -->
        <div class="mb-4">
          <label for="land-type" class="block font-semibold mb-2 text-gray-700">选择土地类型 (将应用于所有选中图层):</label>
          <select id="land-type" v-model="selectedLandType" class="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="其他土地">其他土地</option>
            <option value="耕地">耕地</option>
            <option value="基本农田">基本农田</option>
          </select>
        </div>


        <!-- 生成的处罚方案文本 -->
        <div class="bg-gray-100 p-4 border border-gray-200 rounded-md">
          <pre class="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-900">{{ penaltyText }}</pre>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="mt-6 pt-4 border-t text-right">
        <button @click="$emit('close')" class="px-5 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { getPenaltyDetails } from '../penalty_logic/penaltyService';
const props = defineProps({
  isVisible: Boolean,
  layers: { type: Array, required: true },
  mode: { type: String, default: 'single' },
  selectableLayers: { type: Array, default: () => [] }
});

defineEmits(['close']);

const selectedIssue = ref('非法占用土地(未批先建)');
const selectedLandType = ref('其他土地'); // 新增：土地类型
const selectedLayerIds = ref([]);

// 监听模式和图层变化，自动选择
watch(() => [props.layers, props.mode], () => {
  if (props.mode === 'single' && props.layers.length > 0) {
    selectedLayerIds.value = [props.layers[0].id];
  } else {
    selectedLayerIds.value = [];
  }
}, { immediate: true, deep: true });

const activeLayers = computed(() => {
    if (props.mode === 'single') return props.layers;
    return props.selectableLayers.filter(l => selectedLayerIds.value.includes(l.id));
});

const penaltyText = computed(() => {
  if (activeLayers.value.length === 0) {
    return '请在上方选择一个或多个图层以生成方案。';
  }

  let summableFine = 0;
  let hasUnsummableFine = false;

  const individualReports = activeLayers.value.map(layer => {
    const details = { ...layer, landType: selectedLandType.value };
    const { report, fine } = getPenaltyDetails(selectedIssue.value, details);
    
    if (!isNaN(fine)) {
      summableFine += fine;
    } else {
      hasUnsummableFine = true;
    }
    return report;
  }).join('\n\n----------------------------------------\n\n');
  
  if (props.mode === 'batch' && activeLayers.value.length > 0) {
    const totalArea = activeLayers.value.reduce((sum, l) => sum + (l.area || 0), 0);
    
    let totalFineText = `总计罚款: 人民币 ${summableFine.toLocaleString()} 元整。`;
    if (hasUnsummableFine) {
      totalFineText += '\n(注意: 部分项目罚款需根据违法所得或土地复垦费等另行计算，未计入总额。)';
    }

    const summary = `
【汇总信息】
总计图层数: ${activeLayers.value.length}
总计面积: ${totalArea.toFixed(2)} 平方米
${totalFineText}

备注: 该处罚方案为系统根据《陕西省自然资源行政处罚裁量权实施基准》自动生成，具体执行需结合实际情况调整。
    `.trim();
    return `${individualReports}\n\n========================================\n\n${summary}`;
  }
  
  return `${individualReports}\n\n备注: 该处罚方案为系统根据《陕西省自然资源行政处罚裁量权实施基准》自动生成，具体执行需结合实际情况调整。`;
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #a0aec0;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background-color: #edf2f7;
}
</style>