<!-- src/App.vue -->
<template>
  <div class="w-screen h-screen relative">
    <!-- 地图容器：通过事件与父组件通信 -->
    <MapContainer 
      :provider="currentMapProvider"
      :provider-config="providerConfig"
      :map-theme="currentMapTheme"
      @ready="onMapReady"
      :is-loading="!isMapReady"
      @unready="onMapUnready"
    />

    <!-- 侧边栏：通过 inject 消费父组件的状态 -->
    <AppSidebar
      :is-visible="isSidebarVisible"
      :provider-name="currentMapProviderName"
      :provider-logo="currentMapProviderLogo"
      @close="isSidebarVisible = false"
    />

    <!-- UI控件：控制父组件的状态 -->
    <div
      class="absolute top-6 left-6 flex items-center bg-white p-1.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out z-[1001]"
      :class="{ 'opacity-0 pointer-events-none': isSidebarVisible }"
    >
      <button @click="isSidebarVisible = true" class="group p-2 rounded-full hover:bg-gray-100 transition-colors" title="打开侧边栏">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-700 group-hover:text-blue-600 transition-colors"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <select
        v-model="currentMapProvider"
        class="ml-2 bg-transparent text-gray-700 py-1.5 px-3 rounded-full appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all text-sm cursor-pointer"
        title="切换地图源"
      >
        <option value="amap">高德地图</option>
        <option value="tianditu">天地图</option>
        <option value="tencent">腾讯地图</option>
        <option value="osm">OSM</option>
      </select>

      <button @click="toggleMapTheme" class="ml-2 p-2 rounded-full hover:bg-gray-100 transition-colors" title="切换影像/街道">
        <svg v-if="currentMapTheme === 'normal'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-700"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-gray-700"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, provide, watch } from 'vue';
import MapContainer from './components/map/MapContainer.vue';
import AppSidebar from './components/map/AppSidebar.vue';
import { transformGeoJsonCoords, wgs84togcj02 } from './map-logic/coordTransform.js';
import { AmapAdapter } from './map-logic/adapters/AmapAdapter.js';
import { TencentAdapter } from './map-logic/adapters/TencentAdapter.js';

// 导入Logo资源
import amapLogo from '/gaodeLogo.png';
import tiandituLogo from '/tianditu.png';
import tencentLogo from '/tencent.png';
import osmLogo from '/osm.png';


// --- 1. 将所有共享状态定义在父组件 ---
const mapAdapter = ref(null);
const isMapReady = ref(false);
const loadedLayersData = ref([]);
const currentMapTheme = ref('normal'); // 'normal' 或 'satellite',切换卫星地图和街道地图

// --- 2. 将这些状态 provide 给所有子组件 ---
provide('mapAdapter', mapAdapter);
provide('isMapReady', isMapReady);
provide('loadedLayersData', loadedLayersData);


// --- 3. 处理来自 MapContainer 的事件 ---
function onMapReady(adapter) {
  console.log('[App.vue] Event "ready" received. Map is ready. Adapter:', adapter.constructor.name);
  mapAdapter.value = adapter;
  isMapReady.value = true;
  
  // 当新地图就绪后，立即重新加载所有图层
  reAddAllLayers(adapter);
}

function onMapUnready() {
  console.log('[App.vue] Event "unready" received. Map is not ready.');
  isMapReady.value = false;
  mapAdapter.value = null;
}

// --- 4. 切换地图时重载图层的逻辑 ---
function reAddAllLayers(adapter) {
  if (!adapter || !loadedLayersData.value || loadedLayersData.value.length === 0) {
    return;
  }

  console.log(`[App.vue] Re-adding ${loadedLayersData.value.length} layers to the new map.`);
  
  const needsTransform = adapter instanceof AmapAdapter || adapter instanceof TencentAdapter;

  loadedLayersData.value.forEach(layerData => {
    let geojsonForMap = layerData.originalData;
    if (needsTransform) {
      try {
        geojsonForMap = transformGeoJsonCoords(JSON.parse(JSON.stringify(layerData.originalData)), wgs84togcj02);
      } catch (e) {
        console.error(`[App.vue] Coordinate transformation failed for layer ${layerData.name}:`, e);
        return; // Skip this layer
      }
    }
    
    adapter.addGeoJsonLayer(geojsonForMap, { id: layerData.id, name: layerData.name });
    if (!layerData.isVisible) {
      adapter.toggleLayerVisibility(layerData.id, false);
    }
  });
}


// --- 5. UI 控制状态 ---
const isSidebarVisible = ref(false);
const currentMapProvider = ref('amap');

const providerConfig = {
  amap: { key: '5d4d6dae7a5c65efb514bae12e669422', securityCode: '23cadd0149127f0c18ae702236f72806' },
  tianditu: { key: '0a7965f62c288964aed9de0d459f1145' },
  tencent: { key: 'BLMBZ-HWKKO-UB2W4-SYIZK-MQJV7-6NFCF' },
  osm: {},
};

const currentMapProviderName = computed(() => {
  return { amap: '高德地图', tianditu: '天地图', tencent: '腾讯地图', osm: 'OSM' }[currentMapProvider.value] || '未知地图';
});

const currentMapProviderLogo = computed(() => {
  return { amap: amapLogo, tianditu: tiandituLogo, tencent: tencentLogo, osm: osmLogo }[currentMapProvider.value] || '';
});


function addLayer(payload) {
    if (!mapAdapter.value) return;

    const layerId = uuidv4();
    const originalData = payload.data; // WGS-84 GeoJSON

    // --- 计算几何信息 ---
    let area = 0;
    let center = [0, 0];
    
    // 使用高德的 GeometryUtil 来计算，它比较准确
    // 我们需要先将 WGS-84 转为 GCJ-02 来计算
    if (window.AMap && window.AMap.GeometryUtil) {
        try {
            const tempGcj02Data = transformGeoJsonCoords(JSON.parse(JSON.stringify(originalData)), wgs84togcj02);
            if (tempGcj02Data.features.length > 0) {
                const firstFeature = tempGcj02Data.features[0];
                if (firstFeature.geometry.type === 'Polygon') {
                    const path = firstFeature.geometry.coordinates[0].map(c => new AMap.LngLat(c[0], c[1]));
                    area = AMap.GeometryUtil.ringArea(path);
                    const bounds = new AMap.Bounds(path);
                    const gcjCenter = bounds.getCenter();
                    center = gcj02towgs84(gcjCenter.lng, gcjCenter.lat); // 转回 WGS-84 存储
                }
                // 可以补充 MultiPolygon 的逻辑
            }
        } catch(e) { console.error("Error calculating geometry info:", e); }
    }
    
    // 更新中央数据源
    loadedLayersData.value.push({
        id: layerId,
        name: payload.name,
        isVisible: true,
        originalData: originalData,
        area: area, // 存储面积 (平方米)
        center: center, // 存储中心点 [lng, lat] (WGS-84)
    });
    
    // 后续的 addGeoJsonLayer 逻辑不变 (在 reAddAllLayers 中处理)
    // 需要触发一次图层重载或直接调用 adapter 添加
    reAddAllLayers(mapAdapter.value);
}

// 切换地图主题（影像/街道）
function toggleMapTheme() {
  currentMapTheme.value = currentMapTheme.value === 'normal' ? 'satellite' : 'normal';
  console.log(`[App.vue] Map theme changed to: ${currentMapTheme.value}`);
}

// 监听地图提供商的变化，如果切换到了不支持卫星图的源（例如OSM），则自动切回普通模式
watch(currentMapProvider, (newProvider) => {
  if (newProvider === 'osm') {
    currentMapTheme.value = 'normal';
  }
});
</script>