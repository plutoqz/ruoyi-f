<!-- src/components/map/MapContainer.vue -->
<template>
  <div class="map-wrapper relative w-full h-full">
    <div id="map-container" class="relative w-full h-full"></div>
    <div v-if="isLoading" class="absolute inset-0 bg-gray-200 flex items-center justify-center z-10">
      <p class="text-gray-600">地图加载中...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, provide, nextTick } from 'vue';
import { AmapAdapter } from '../../map-logic/adapters/AmapAdapter.js';
import { OpenLayersAdapter } from '../../map-logic/adapters/OpenLayersAdapter.js';
import { TencentAdapter } from '../../map-logic/adapters/TencentAdapter.js';
import { transformGeoJsonCoords, wgs84togcj02 } from '../../map-logic/coordTransform.js';

const props = defineProps({
  provider: {
    type: String,
    required: true,
  },
  providerConfig: {
    type: Object,
    required: true,
  },
  isLoading: { 
    type: Boolean, 
    default: true 
  },
  mapTheme: { 
    type: String, 
    default: 'normal' 
  } // **新增：接收主题 prop**
});

// 定义要发出的事件
const emit = defineEmits(['ready', 'unready']);

// 使用本地(local) ref 存储适配器实例和状态，不与外部共享
const localAdapter = ref(null);
// const isAdapterReady = ref(false);
const lastMapView = ref({ center: [113.0, 28.2], zoom: 10 });

// **不再需要 provide**

async function initializeMap() {
//   isAdapterReady.value = false;
  emit('unready'); // 通知父组件地图已不再就绪

  if (localAdapter.value) {
    lastMapView.value = localAdapter.value.getMapView() || lastMapView.value;
    localAdapter.value.destroy();
    localAdapter.value = null;
  }
  
  await nextTick();

  try {
    console.log(`[MapContainer] Creating adapter for: ${props.provider}`);
    switch (props.provider) {
      case 'amap':
        localAdapter.value = new AmapAdapter('map-container', props.providerConfig.amap);
        break;
      case 'tianditu':
        localAdapter.value = new OpenLayersAdapter('map-container', { ...props.providerConfig.tianditu, provider: 'tianditu' });
        break;
      case 'osm':
        localAdapter.value = new OpenLayersAdapter('map-container', { provider: 'osm' });
        break;
      case 'tencent':
        localAdapter.value = new TencentAdapter('map-container', props.providerConfig.tencent);
        break;
      default:
        throw new Error(`不支持的地图提供者: ${props.provider}`);
    }

    console.log('[MapContainer] Initializing adapter...');
    await localAdapter.value.init(lastMapView.value);
    // isAdapterReady.value = true;
    
    // 通过 emit 将适配器实例和就绪状态通知父组件
    emit('ready', localAdapter.value);

  } catch (error) {
    console.error(`[MapContainer] 初始化地图失败:`, error);
    // isAdapterReady.value = false;
    emit('unready');
  }
}

onMounted(initializeMap);
watch(() => props.provider, initializeMap);

// **新增：监听 mapTheme prop 的变化**
watch(() => props.mapTheme, (newTheme) => {
  if (localAdapter.value && typeof localAdapter.value.setTheme === 'function') {
    console.log(`[MapContainer] Calling setTheme('${newTheme}') on adapter.`);
    localAdapter.value.setTheme(newTheme);
  } else {
    // 如果适配器不支持 setTheme，或者还未初始化，可以考虑重新初始化地图
    // 重新初始化会保持视图位置，是比较稳妥的 fallback
    console.log('[MapContainer] Adapter does not support setTheme or is not ready, re-initializing map.');
    initializeMap();
  }
});

onBeforeUnmount(() => {
  if (localAdapter.value) {
    localAdapter.value.destroy();
  }
  emit('unready');
});
</script>

<style>
/* 可以在这里添加 OpenLayers 的 Overlay 样式 */
.custom-info-window {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  overflow: hidden;
  font-family: sans-serif;
  width: auto;
  min-width: 200px;
}
</style>