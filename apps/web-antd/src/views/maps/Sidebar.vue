<template>
  <aside
    v-show="isVisible"
    class="absolute top-0 bottom-0 left-0 w-56 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-out p-4 flex flex-col"
    :class="{ 'translate-x-0': isVisible, '-translate-x-full': !isVisible }"
  >
    <div class="flex justify-between items-center mb-4 pb-2 border-b">
      <img
        v-if="providerLogo"
        :src="providerLogo"
        :alt="providerName + ' Logo'"
        class="h-8 object-contain"
      />
      <span v-else class="text-sm font-semibold">{{ providerName || '地图工具' }}</span>
      <button
        @click="closeSidebar"
        class="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        title="关闭侧边栏"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <div class="flex-grow overflow-y-auto space-y-4 pr-1 custom-scrollbar">
      <section>
        <h3 
          @click="toggleImportSection" 
          class="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider cursor-pointer flex justify-between items-center hover:text-blue-600 transition-colors"
        >
          <span class="group-hover:text-blue-500 transition-colors duration-300 text-base md:text-lg" style="vertical-align: middle;">数据导入</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather transition-transform duration-200 ease-in-out" :class="{'rotate-180': isImportSectionOpen, 'rotate-0': !isImportSectionOpen}"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </h3>
        <div v-if="isImportSectionOpen" class="mt-2 pl-3 border-l-2 border-gray-200 ml-1 space-y-1 transition-all duration-300 ease-in-out">
          <GeoJsonImporter @geojson-loaded="onGeoJsonLoadedRelay" @geojson-error="onGeoJsonErrorRelay" />
          <ShapefileImporter @shp-loaded="onShpLoadedRelay" @shp-error="onShpErrorRelay" />
          <!-- 您可以在这里添加其他导入器 -->
        </div>
      </section>
      
      <section >
        <h3 
          @click="toggleSearchSection" 
          class="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider cursor-pointer flex justify-between items-center hover:text-blue-600 transition-colors"
        >
          <span class="group-hover:text-blue-500 transition-colors duration-300 text-base md:text-lg" style="vertical-align: middle;">空间查询</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather transition-transform duration-200 ease-in-out" :class="{'rotate-180': isSearchSectionOpen, 'rotate-0': !isSearchSectionOpen}"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </h3>
        
        <div v-if="isSearchSectionOpen" class="mt-2 pl-3 border-l-2 border-gray-200 ml-1 space-y-1 transition-all duration-300 ease-in-out">
          <button @click.stop="toggleBoxSelect"
          class="w-full group flex items-center p-2 rounded text-gray-700 transition-all duration-300 ease-in-out text-sm"
          :class="isBoxSelectActive ? 'bg-blue-500 text-white hover:bg-blue-600' : 'group-hover:text-blue-500 transition-colors duration-300 text-base md:text-sm'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" viewBox="0 0 24 24" fill="none" :stroke="isBoxSelectActive ? 'white' : 'currentColor'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-crop mr-2.5"><path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path><path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path></svg>
          {{ isBoxSelectActive ? '取消框选模式' : '框选查询' }}
        </button>
        <button @click.stop="toggleInfoQuery"
            class="w-full group flex items-center p-2 rounded text-gray-700 transition-all duration-300 ease-in-out text-sm"
            :class="isInfoQueryActive ? 'bg-blue-500 text-white hover:bg-blue-600' : 'hover:bg-gray-100 hover:text-blue-600'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" viewBox="0 0 24 24" fill="none" :stroke="isInfoQueryActive ? 'white' : 'currentColor'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-mouse-pointer mr-2.5"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path></svg>
            {{ isInfoQueryActive ? '取消查询' : '点击查询' }}
          </button>
        </div>

      </section>


      <section>
        <h3 
          @click="togglePlannerSection" 
          class="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider cursor-pointer flex justify-between items-center hover:text-blue-600 transition-colors"
        >
          <span class="group-hover:text-blue-500 transition-colors duration-300 text-base md:text-lg" style="vertical-align: middle;">处罚方案</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather transition-transform duration-200 ease-in-out" :class="{'rotate-180': isPlannerSectionOpen, 'rotate-0': !isPlannerSectionOpen}"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </h3>
        <!-- 将其改为一个明确的按钮来触发事件 -->
        <div v-if="isPlannerSectionOpen" class="mt-2 pl-3 border-l-2 border-gray-200 ml-1 space-y-1 transition-all duration-300 ease-in-out">
          <button 
            @click="openPlannerPanel"
            class="w-full group flex items-center p-2 rounded text-gray-700 transition-all duration-300 ease-in-out text-sm hover:bg-blue-100 hover:text-blue-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mr-2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            划定区域
          </button>
          <button 
            @click="jsonPlannerPanel"
            class="w-full group flex items-center p-2 rounded text-gray-700 transition-all duration-300 ease-in-out text-sm hover:bg-blue-100 hover:text-blue-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mr-2.5">
              <path d="M7 0h4v2h-4v-2zm9 2v3h2v-5h-5v2h3zm-16 9h2v-4h-2v4zm4 5h-2v-3h-2v5h4v-2zm-2-11v-3h3v-2h-5v5h2zm22 2v17h-18v-17h18zm-2 5h-14v10h14v-10z"/></svg>
            已有区域
          </button>

        </div>
      </section>
      <!-- 图层管理和查询结果移至 LayerManager 组件 -->
      <LayerManager
        :layers="layers"
        :selected-features="selectedFeatures"
        :box-select-attempted="boxSelectAttempted"
        @remove-layer="removeLayer"
        @toggle-layer-visibility="toggleLayerVisibility"
        @clear-selection="clearSelection"
        v-if="layers && layers.length > 0"
      />
      <!-- <LabelDrawer v-if="isDrawerVisible" @close="isDrawerVisible = false" /> -->
      <!-- 当没有图层时，可以显示一个提示信息 -->
      <!-- <div v-else class="text-xs text-gray-400 text-center py-4">
        暂无图层。请通过上方导入数据。
      </div> -->

       <!-- 查询结果部分已移至 LayerManager -->
    </div>
  </aside>

  <!-- <aside
    v-show="LayerManagerisVisible"
    class="absolute top-0 bottom-0 right-0 w-56 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-out p-4 flex flex-col"
    :class="{ 'translate-x-0': LayerManagerisVisible, '-translate-x-full': !LayerManagerisVisible }"
  ></aside> -->

</template>

<script setup>
import {ref, defineProps, defineEmits } from 'vue';
import GeoJsonImporter from './GeoJsonImporter.vue'; // 确保路径正确
import ShapefileImporter from './ShapefileImporter.vue'; // 新增
import LayerManager from './LayerManager.vue'; // 新增
// import LabelDrawer from './LabelDrawer.vue';

const props = defineProps({
  isVisible: { type: Boolean, required: true },
  // LayerManagerisVisible: { type: Boolean, required: true },
  providerLogo: { type: String, default: '' },
  providerName: { type: String, default: '当前地图' },
  layers: { type: Array, default: () => [] },
  isBoxSelectActive: { type: Boolean, default: false },
  selectedFeatures: { type: Array, default: () => [] },
  boxSelectAttempted: { type: Boolean, default: false },
  isInfoQueryActive: { type: Boolean, default: false },
  // map: {type: Object,required: true},
});

const emit = defineEmits([
  'close-sidebar',
  'geojson-loaded',
  'geojson-error',
  'shp-loaded',         // 新增
  'shp-error',          // 新增
  'remove-layer',
  'toggle-layer-visibility',
  'toggle-box-select',
  'clear-selection',
  'open-planner-panel',//处罚方案
  'json-planner-panel',//处罚方案
  'toggle-info-query',//点击查询
]);

const closeSidebar = () => emit('close-sidebar');

const openPlannerPanel = () => {
  emit('open-planner-panel');
};
const jsonPlannerPanel = () => {
  emit('json-planner-panel');
};


const isImportSectionOpen = ref(false); // 控制导入部分是否展开，默认为false
const toggleImportSection = () => {
  isImportSectionOpen.value = !isImportSectionOpen.value;
};

const isSearchSectionOpen = ref(false); // 控制查询部分是否展开，默认为false
const toggleSearchSection = () => {
  isSearchSectionOpen.value = !isSearchSectionOpen.value;
};

const isPlannerSectionOpen = ref(false);// 控制判罚部分是否展开，默认为false
const togglePlannerSection = () => {
  isPlannerSectionOpen.value = !isPlannerSectionOpen.value;
}

const onGeoJsonLoadedRelay = (payload) => {
  // 您之前的日志和校验逻辑可以保留
  emit('geojson-loaded', payload);
};

const onGeoJsonErrorRelay = (errorMessage) => {
  emit('geojson-error', errorMessage);
};

const onShpLoadedRelay = (payload) => {
  // SHP文件成功加载后，通常会转换为GeoJSON格式进行处理
  // 所以事件名和GeoJSON保持一致或类似，但payload结构可能包含原始文件名等信息
  console.log('Sidebar: Relaying "shp-loaded". Payload name:', payload ? payload.name : 'N/A');
  emit('shp-loaded', payload); // emit('geojson-loaded', payload); 如果希望统一处理
};

const onShpErrorRelay = (errorMessage) => {
  emit('shp-error', errorMessage);
};

const removeLayer = (layerId) => emit('remove-layer', layerId);
const toggleLayerVisibility = (layerId) => emit('toggle-layer-visibility', layerId);
const toggleBoxSelect = () => emit('toggle-box-select');
const clearSelection = () => emit('clear-selection');
const toggleInfoQuery = () => emit('toggle-info-query');
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
.feather { /* 确保SVG图标大小一致 */
  display: inline-block;
  vertical-align: middle;
  
}


</style>
