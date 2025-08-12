<template>
  <div>
    <section v-if="layers && layers.length > 0">
      <h3 class="font-semibold text-gray-700">图层管理 ({{ layers.length }})</h3>
      <ul class="space-y-1 text-sm">
        <li
          v-for="layer in layers"
          :key="layer.id"
          class="flex items-center justify-between p-2 rounded hover:bg-gray-100 transition-colors"
          :class="{'bg-gray-50': !layer.isVisible}"
        >
          <span class="truncate mr-2 flex-grow" :title="layer.name" :class="{'text-gray-400': !layer.isVisible}">{{ layer.name }}</span>
          <div class="flex items-center space-x-2 flex-shrink-0">
            <button
              @click="toggleLayerVisibility(layer.id)"
              :title="layer.isVisible ? '隐藏图层' : '显示图层'"
              class="p-1 rounded hover:bg-gray-200 text-gray-600 hover:text-blue-600"
            >
              <svg v-if="layer.isVisible" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-eye-off"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            </button>
            <button @click="removeLayer(layer.id)" title="移除图层" class="p-1 rounded hover:bg-gray-200 text-red-500 hover:text-red-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="boxSelectAttempted || (selectedFeatures && selectedFeatures.length > 0)" class="mt-4">
      <h3 class="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">查询结果</h3>
      <div v-if="selectedFeatures && selectedFeatures.length > 0" class="max-h-64 overflow-y-auto bg-gray-50 p-2.5 rounded text-xs space-y-2 custom-scrollbar">
        <p class="text-gray-600 mb-1">在选定区域内找到 {{ selectedFeatures.length }} 个要素:</p>
        <details v-for="(feature, index) in selectedFeatures" :key="feature.layerId + '-' + index" class="border-b pb-1.5 mb-1.5 last:border-b-0 last:mb-0">
          <summary class="cursor-pointer hover:text-blue-600 text-gray-700 text-xs">
            要素 {{ index + 1 }} (图层: {{ feature.layerName }})
          </summary>
          <pre class="mt-1.5 p-2 bg-white rounded text-gray-800 whitespace-pre-wrap break-all text-[11px] leading-relaxed shadow-sm">{{ JSON.stringify(feature.properties, null, 2) }}</pre>
        </details>
          <button @click="clearSelection" class="mt-2 w-full text-xs text-center text-blue-600 hover:text-blue-800 py-1 rounded hover:bg-blue-50 transition-colors">清空查询结果</button>
      </div>
      <div v-else-if="boxSelectAttempted && (!selectedFeatures || selectedFeatures.length === 0)" class="text-xs text-gray-500 p-2 bg-gray-50 rounded">
        在选定区域内未找到任何要素。
      </div>
    </section>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  layers: { type: Array, default: () => [] },
  selectedFeatures: { type: Array, default: () => [] },
  boxSelectAttempted: { type: Boolean, default: false },
});

const emit = defineEmits([
  'remove-layer',
  'toggle-layer-visibility',
  'clear-selection'
]);

const removeLayer = (layerId) => emit('remove-layer', layerId);
const toggleLayerVisibility = (layerId) => emit('toggle-layer-visibility', layerId);
const clearSelection = () => emit('clear-selection');
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #a0aec0; /* Tailwind gray-500 */
  border-radius: 10px;
  border: 1px solid #edf2f7; /* Tailwind gray-200 */
}
.custom-scrollbar::-webkit-scrollbar-track {
  background-color: #edf2f7; /* Tailwind gray-200 */
  border-radius: 10px;
}
.feather {
  display: inline-block;
  vertical-align: middle;
}
</style>
