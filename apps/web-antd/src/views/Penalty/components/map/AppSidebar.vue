<!-- src/components/map/AppSidebar.vue -->
<template>
  <BaseSidebar :is-visible="isVisible" @close="$emit('close')">
    <template #header>
      <img v-if="providerLogo" :src="providerLogo" :alt="providerName" class="h-8 object-contain" />
      <span v-else class="text-sm font-semibold">{{ providerName }}</span>
    </template>

    <!-- 主体内容 -->
    <div class="space-y-4">
      <section>
        <h3 class="font-semibold text-gray-700">数据导入</h3>
        <div class="mt-2 space-y-2">
           <GeoJsonImporter @geojson-loaded="handleGeoJsonLoaded" />
           <!-- ShapefileImporter 等 -->
        </div>
      </section>

      <!-- **新增：地图绘制工具** -->
      <section>
        <h3 class="font-semibold text-gray-700">地图工具</h3>
        <div class="mt-2 space-y-2">
          <button @click="togglePolygonDraw" class="w-full text-left p-2 rounded flex items-center hover:bg-gray-100" :class="{'bg-blue-100 text-blue-700': isDrawingActive}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
            {{ isDrawingActive ? '取消绘制' : '绘制区域' }}
          </button>
          <!-- 以后可以添加绘制点、线等按钮 -->
        </div>
      </section>

      <!-- <section>
        <h3 class="font-semibold text-gray-700">空间查询</h3>
        <div class="mt-2 space-y-2">
            <button @click="toggleBoxSelect" class="w-full text-left p-2 rounded hover:bg-gray-100" :class="{'bg-blue-100 text-blue-700': isBoxSelectActive}">
                {{ isBoxSelectActive ? '取消框选' : '框选查询' }}
            </button>
            <button @click="toggleInfoQuery" class="w-full text-left p-2 rounded hover:bg-gray-100" :class="{'bg-blue-100 text-blue-700': isInfoQueryActive}">
                {{ isInfoQueryActive ? '取消查询' : '点击查询' }}
            </button>
        </div>
      </section> -->
      
      <!-- 图层管理 -->
      <LayerManager
        :layers="layers"
        :selected-features="selectedFeatures"
        @remove-layer="removeLayer"
        @toggle-layer-visibility="toggleLayerVisibility"
        @clear-selection="selectedFeatures = []"
      />

      <section>
          <h3 class="font-semibold text-gray-700">处罚方案</h3>
          <div class="mt-2 space-y-2">
            <!-- <button @click="handleBatchPenalty" class="w-full text-left p-2 rounded flex items-center hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              生成方案
            </button> -->
            <button @click="handleBatchPenalty" class="w-full text-left p-2 rounded flex items-center hover:bg-gray-100">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="mr-2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
              智能判罚
            </button>
          </div>
      </section>
    </div>
  </BaseSidebar>
  <PenaltyModal
    :is-visible="isPenaltyModalVisible"
    :layers="penaltyModalData.layers"
    :mode="penaltyModalData.mode"
    :selectable-layers="loadedLayersData"
    @close="isPenaltyModalVisible = false"
  />
</template>

<script setup>
import { ref, inject, computed,watch} from 'vue';
import { v4 as uuidv4 } from 'uuid';
import BaseSidebar from '../shared/BaseSidebar.vue';
import GeoJsonImporter from '../shared/GeoJsonImporter.vue';
import LayerManager from '../shared/LayerManager.vue';
import { transformGeoJsonCoords, wgs84togcj02, gcj02towgs84  } from '../../map-logic/coordTransform.js';
import { AmapAdapter } from '../../map-logic/adapters/AmapAdapter.js';
import { TencentAdapter } from '../../map-logic/adapters/TencentAdapter.js';
import PenaltyModal from '../PenaltyModal.vue';
const props = defineProps({
  isVisible: Boolean,
  providerName: String,
  providerLogo: String,
});
defineEmits(['close']);

// --- 注入来自父组件的稳定状态 ---
const mapAdapter = inject('mapAdapter', ref(null));
const isMapReady = inject('isMapReady', ref(false));
// const loadedLayersData = inject('loadedLayersData', ref([]));

const loadedLayersData = ref([]);
const pendingGeoJson = ref(null);
const layers = ref([]);
const selectedFeatures = ref([]);
const isBoxSelectActive = ref(false);
const isInfoQueryActive = ref(false);

const isDrawingActive = ref(false);//绘制状态

// **新增：模态框状态管理**
const isPenaltyModalVisible = ref(false);
const penaltyModalData = ref({
  layers: [],
  mode: 'single'
});

// 监听中央数据源的变化，同步到侧边栏的UI
watch(loadedLayersData, (newData) => {
  if (Array.isArray(newData)) {
    layers.value = newData.map(d => ({ id: d.id, name: d.name, isVisible: d.isVisible }));
  }
}, { deep: true, immediate: true });

// 监听地图就绪状态，处理暂存的文件
watch(isMapReady, (ready, prevReady) => {
  console.log(`[AppSidebar] isMapReady watcher triggered. New value: ${ready}, Old value: ${prevReady}`);
  if (ready && pendingGeoJson.value) {
    console.log('[AppSidebar] Watch condition met. Processing pending GeoJSON.');
    processGeoJson(pendingGeoJson.value);
    pendingGeoJson.value = null;
  }
});

function handleGeoJsonLoaded(payload) {
  console.log('[AppSidebar] GeoJSON loaded. Checking map status...');
  if (isMapReady.value && mapAdapter.value) {
    console.log('[AppSidebar] Map is ready. Processing immediately.');
    processGeoJson(payload);
  } else {
    console.log('[AppSidebar] Map not ready. Storing payload.');
    pendingGeoJson.value = payload;
    alert('地图正在初始化，文件将在地图加载完成后自动添加。');
  }
}

function processGeoJson(payload) {
  if (!mapAdapter.value) {
    console.error('processGeoJson called, but mapAdapter is not ready.');
    alert('地图未就绪，无法添加图层。');
    return;
  }

  const layerId = uuidv4();
  const originalData = payload.data; // 这是标准的 WGS-84 GeoJSON

  // --- 1. 计算面积和中心点 ---
  let area = 0;
  let center = [0, 0]; // 默认值

  // 优先使用高德地图的JS API来计算
  if (window.AMap && window.AMap.GeometryUtil) {
    try {
      // 为了计算，我们需要一份 GCJ-02 坐标的 GeoJSON
      const tempGcj02Data = transformGeoJsonCoords(JSON.parse(JSON.stringify(originalData)), wgs84togcj02);
      
      if (tempGcj02Data.features.length > 0) {
        const firstFeature = tempGcj02Data.features[0];

        if (firstFeature.geometry.type === 'Polygon') {
          const path = firstFeature.geometry.coordinates[0].map(c => new AMap.LngLat(c[0], c[1]));
          
          // 计算面积 (平方米)
          area = AMap.GeometryUtil.ringArea(path);
          
          // 计算中心点
          const bounds = new AMap.Polygon({ path }).getBounds();
          const gcjCenter = bounds.getCenter();
          
          // 将计算出的 GCJ-02 中心点转回 WGS-84 存储
          center = gcj02towgs84(gcjCenter.lng, gcjCenter.lat); 
        }
      }
    } catch(e) { 
      console.error("[AppSidebar] Error calculating geometry info:", e); 
    }
  } else {
    console.warn("[AppSidebar] AMap GeometryUtil not available. Calculation skipped.");
  }
  
  // --- 2. 更新本地的图层列表，并存入新计算的数据 ---
  loadedLayersData.value.push({
    id: layerId,
    name: payload.name,
    isVisible: true,
    // originalData: originalData, // 可选：存储原始数据用于地图切换
    area: area,       // 新增
    center: center,   // 新增
  });

  // --- 3. 将图层添加到地图上的逻辑保持不变 ---
  const currentAdapter = mapAdapter.value;
  const needsTransform = currentAdapter instanceof AmapAdapter || currentAdapter instanceof TencentAdapter;
  const dataForMap = needsTransform ? transformGeoJsonCoords(JSON.parse(JSON.stringify(originalData)), wgs84togcj02) : originalData;

  currentAdapter.addGeoJsonLayer(dataForMap, { id: layerId, name: payload.name });
}

function removeLayer(layerId) {
    if (!mapAdapter.value) return;
    mapAdapter.value.removeLayer(layerId);
    const index = loadedLayersData.value.findIndex(l => l.id === layerId);
    if (index > -1) loadedLayersData.value.splice(index, 1);
}

function toggleLayerVisibility(layerId) {
    if (!mapAdapter.value) return;
    const layer = loadedLayersData.value.find(l => l.id === layerId);
    if (layer) {
        layer.isVisible = !layer.isVisible;
        mapAdapter.value.toggleLayerVisibility(layerId, layer.isVisible);
    }
}

function toggleBoxSelect() {
  if (!mapAdapter.value) return;
  isBoxSelectActive.value = !isBoxSelectActive.value;
  if(isBoxSelectActive.value) {
    if(isInfoQueryActive.value) toggleInfoQuery();
    mapAdapter.value.enableBoxSelect(features => {
      selectedFeatures.value = features;
      isBoxSelectActive.value = false;
    });
  } else {
    mapAdapter.value.disableBoxSelect();
  }
}

function toggleInfoQuery() {
  if (!mapAdapter.value) return;
  isInfoQueryActive.value = !isInfoQueryActive.value;
  if(isInfoQueryActive.value) {
    if(isBoxSelectActive.value) toggleBoxSelect();
    mapAdapter.value.enableInfoQuery();
  } else {
    mapAdapter.value.disableInfoQuery();
  }
}

//绘制多边形
function togglePolygonDraw() {
  if (!mapAdapter.value) return;

  isDrawingActive.value = !isDrawingActive.value;

  if (isDrawingActive.value) {
    if (isBoxSelectActive.value) toggleBoxSelect();
    if (isInfoQueryActive.value) toggleInfoQuery();

    mapAdapter.value.enablePolygonDraw(featureCollection => {
      // 这个回调现在会在每次双击结束一个多边形时触发
      console.log('[AppSidebar] A polygon was drawn:', featureCollection);
      
      // **移除** 自动退出绘制模式的逻辑
      // isDrawingActive.value = false; <-- 注释掉或删除

      if (featureCollection && featureCollection.features.length > 0) {
        const drawnLayerPayload = {
          name: `绘制的多边形-${Date.now().toString().slice(-4)}`,
          // **重要**：现在 adapter 返回的是标准的 WGS-84 GeoJSON
          // 所以 processGeoJson 可以直接使用它
          data: featureCollection,
        };
        processGeoJson(drawnLayerPayload);
      }
    });
  } else {
    // 用户手动点击“取消绘制”
    mapAdapter.value.disablePolygonDraw();
  }
}

//打开处罚方案模态框
function openPenaltyModal(config) {
  penaltyModalData.value = {
    layers: config.layers || [],
    mode: config.mode || 'single',
  };
  isPenaltyModalVisible.value = true;
}
// 处理批量判罚按钮的点击
function handleBatchPenalty() {
  console.log("Opening batch penalty modal.");
  openPenaltyModal({
    mode: 'batch',
    layers: [] // 批量模式下，初始选中的图层为空
  });
}
</script>