<template>
  <div class="map-wrapper relative w-full h-full">
    <div id="map-container" class="relative w-full h-full"></div>
    <div
      class="absolute top-6 left-6 flex items-center bg-white p-1.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out z-[1001]"
      :class="{ 'opacity-0 pointer-events-none': sidebarState.isVisible, 'opacity-100': !sidebarState.isVisible }"
    >
      <button @click="openSidebarHandler" class="group p-2 rounded-full hover:bg-gray-100 transition-colors" title="打开侧边栏">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-700 group-hover:text-blue-600 transition-colors"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <select
        :value="currentMapProvider"
        @change="switchMapProvider($event.target.value)"
        class="ml-2 bg-transparent text-gray-700 py-1.5 px-3 rounded-full appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-all text-sm cursor-pointer"
        title="切换地图源"
      >
        <option value="amap">高德地图</option>
        <option value="tianditu">天地图</option>
        <option value="tencent">腾讯地图</option>
        <option value="osm">OSM</option>
      </select>
    </div>
    <Sidebar

      :is-visible="sidebarState.isVisible"
      :provider-logo="currentMapProviderLogo"
      :provider-name="currentMapProviderName"
      :layers="loadedGeoJsonLayers"
      :is-box-select-active="isBoxSelectActive"
      :selected-features="selectedFeaturesInfo"
      :box-select-attempted="boxSelectAttempted"
      :is-info-query-active="isInfoQueryActive"
      @close-sidebar="closeSidebarHandler"
      @geojson-loaded="handleGeoJsonLoaded"
      @geojson-error="handleGeoJsonError"
      @remove-layer="removeGeoJsonLayerById"
      @toggle-layer-visibility="toggleGeoJsonLayerVisibilityById"
      @toggle-box-select="handleToggleBoxSelect"
      @clear-selection="clearFeatureSelection"
      @open-planner-panel="handleOpenPlannerForDrawing"
      @json-planner-panel="handleOpenPlannerWithJson"
      @toggle-info-query="handleToggleInfoQuery"
    />
    <LabelDrawer 
      v-if="isPlannerVisible" 
      :parcel-data="dataForPlanner"
      @close="closePlanner" 
    />
  </div>
</template>
<script>
import { ref, reactive, onMounted, watch, nextTick, computed, onBeforeUnmount , provide } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import AMapLoader from '@amap/amap-jsapi-loader';
import { Map as OlMap, View, Overlay as OlOverlay } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import XYZ from 'ol/source/XYZ';
import { Draw as OlDraw } from 'ol/interaction';
import { createBox as OlCreateBox } from 'ol/interaction/Draw';
import {transform as OlTransform} from 'ol/proj';
import Sidebar from './Sidebar.vue';
import { wgs84togcj02, transformGeoJsonCoords } from './coordTransform.js';

import amapLogo from 'E:/vscode/my-ruoyi-admin-webgis/ruoyi-admin/gaodeLogo.png';
import tiandituLogo from 'E:/vscode/my-ruoyi-admin-webgis/ruoyi-admin/tianditu.png';
import tencentLogo from 'E:/vscode/my-ruoyi-admin-webgis/ruoyi-admin/tencent.png';
import osmLogo from 'E:/vscode/my-ruoyi-admin-webgis/ruoyi-admin/osm.png';

import LabelDrawer from './LabelDrawer.vue';

window._AMapSecurityConfig = {
  securityJsCode: '23cadd0149127f0c18ae702236f72806', // 请替换为你的高德地图安全密钥
};

export default {
  name: 'MultiMapRefactored',
  components: { Sidebar ,LabelDrawer},
  props: { locationname: { type: String, default: '' } },
  setup(props) {
    const mapInstance = ref(null);
    provide('mapInstance', mapInstance);
    const infoWindow = ref(null);//点击查询处罚信息窗口
    const isInfoQueryActive = ref(false); // 信息查询模式状态
    const currentMapProvider = ref('amap'); // 默认地图提供者
    const is3DMode = ref(false); // 高德地图3D模式相关
    const isMapReady = ref(false);
    const marker = ref(null); // 用于位置搜索标记
    const loadedGeoJsonLayers = ref([]); // 存储加载的GeoJSON图层信息
    
    // 交互工具
    let amapMouseTool = null;
    let olDrawInteraction = null;
    let olDrawLayer = null;

    // 侧边栏和选择状态
    const sidebarState = reactive({ isVisible: false });
    
    const isBoxSelectActive = ref(false);
    const selectedFeaturesInfo = ref([]);
    const boxSelectAttempted = ref(false);

    //处罚方案
    const isPlannerVisible = ref(false);
    const dataForPlanner = ref(null);
    let queryablePolygons = [];
    const handleOpenPlannerForDrawing = () => {
        dataForPlanner.value = null; // Ensure data is null for drawing mode
        isPlannerVisible.value = true;
    };

    const handleOpenPlannerWithJson = () => {
        if (loadedGeoJsonLayers.value.length === 0) {
            alert("请先导入一个包含区域的GeoJSON文件！");
            return;
        }
        
        // Use the most recently added layer
        const lastLayer = loadedGeoJsonLayers.value[loadedGeoJsonLayers.value.length - 1];

        // The LabelDrawer is AMap specific, so it needs the data that was processed for AMap.
        if (!lastLayer.processedData) {
            alert("所选图层没有可用于处罚方案的数据。");
            return;
        }

        dataForPlanner.value = lastLayer.processedData;
        isPlannerVisible.value = true;
        

    };
    const closePlanner = () => {
        isPlannerVisible.value = false;
        dataForPlanner.value = null; // Clean up data on close
    };
    // API密钥和初始配置
    const apiKeys = { 
      amap: '5d4d6dae7a5c65efb514bae12e669422', // 请替换为你的高德地图Key
      tianditu: '0a7965f62c288964aed9de0d459f1145', // 请替换为你的天地图Key
      tencent: 'BLMBZ-HWKKO-UB2W4-SYIZK-MQJV7-6NFCF' // 请替换为你的腾讯地图Key
    };
    // 默认中心点 (经度, 纬度, EPSG:4326) 和缩放级别
    const mapInitialConfigs = { center: [113.0, 28.2], zoom: 10 }; // 示例：长沙
    
    // 存储上一次地图视图 { center: [lng, lat], zoom: number } (EPSG:4326)
    const lastMapView = ref(null); 

    const sdkLoaded = reactive({ amap: false, tencent: false }); // 跟踪SDK加载状态

    // UI相关的计算属性
    const mapProviderNames = { amap: '高德地图', tianditu: '天地图', tencent: '腾讯地图', osm: 'OpenStreetMap' };
    const currentMapProviderLogo = computed(() => ({ amap: amapLogo, tianditu: tiandituLogo, tencent: tencentLogo, osm: osmLogo })[currentMapProvider.value] || '');
    const currentMapProviderName = computed(() => mapProviderNames[currentMapProvider.value] || '未知地图');

    // 侧边栏处理器
    const openSidebarHandler = () => sidebarState.isVisible = true;
    const closeSidebarHandler = () => sidebarState.isVisible = false;

    // 要素选择处理器
    const clearFeatureSelection = () => {
      selectedFeaturesInfo.value = [];
      boxSelectAttempted.value = false;
    };

    // --- GeoJSON 图层管理 ---
    const handleGeoJsonLoaded = (payload) => {
      console.log('[MultiMap] handleGeoJsonLoaded 收到 payload:', payload ? {name: payload.name, type: typeof payload.data} : payload);
      if (!payload || typeof payload.name !== 'string' || !payload.data) {
        console.error('[MultiMap] 无效的 GeoJSON payload:', payload);
        alert('导入 GeoJSON 失败：数据传递错误。');
        return;
      }
      const { name, data: originalGeoJsonData } = payload;
      if (!mapInstance.value || !isMapReady.value) {
        console.error('[MultiMap] 地图未准备好加载 GeoJSON。');
        alert('地图未加载，请稍后再试。');
        return;
      }
      console.log(`[MultiMap] 处理 GeoJSON: ${name}`);
      let processedData = JSON.parse(JSON.stringify(originalGeoJsonData)); // 深拷贝

      // 如果需要，转换坐标 (例如 WGS84 转 GCJ02 用于高德/腾讯)
      // 假设 originalGeoJsonData 是 WGS84 (EPSG:4326)
      if (currentMapProvider.value === 'amap' || currentMapProvider.value === 'tencent') {//currentMapProvider.value === 'amap' || 
        console.log(`  为 ${currentMapProvider.value} 转换 GeoJSON 坐标 (WGS84 到 GCJ02)`);
        try {
            processedData = transformGeoJsonCoords(processedData, wgs84togcj02);
        } catch (e) {
            console.error("  GeoJSON 坐标转换失败:", e);
            alert(`图层 "${name}" 坐标转换失败。`);
        }
      }

      const layerId = uuidv4();
      const mapLayerObject = addGeoJsonToMapInternal(processedData, layerId, name);

      if (mapLayerObject) {
        loadedGeoJsonLayers.value.push({
          id: layerId, 
          name: name || `未命名图层-${layerId.substring(0,4)}`,
          originalData: originalGeoJsonData, // 存储原始数据，以便在地图提供者更改时重新处理
          processedData: processedData, // 存储当前地图使用的数据
          mapLayer: mapLayerObject, 
          isVisible: true,
        });
        // 将地图视图调整到新图层
        if (currentMapProvider.value === 'amap' && mapLayerObject.getBounds) {
          mapInstance.value.setFitView(
            [mapLayerObject], // 仍然使用 Overlay[]，因为 AMap.GeoJSON 是一个 Overlay
                  false,            // false 表示有动画效果
                  [60, 60, 60, 60], // 上右下左的内边距 (pixels)，可以适当调整
                  17                // 最大缩放级别，可以适当调整
          );
        } else if ((currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') && mapLayerObject.getSource()?.getExtent) {
          const extent = mapLayerObject.getSource().getExtent();
          if (extent && extent.every(isFinite)) { // 检查范围是否有效
            mapInstance.value.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 1000, maxZoom:16 });
          }
        }
      } else {
        console.error(`[MultiMap] 添加图层 "${name}" 到地图失败。`);
        alert(`图层 "${name}" 添加失败。`);
      }
    };

    const handleGeoJsonError = (errorMessage) => {
      console.error('[MultiMap] 收到 geojson-error:', errorMessage);
      alert(`GeoJSON 导入失败: ${errorMessage}`);
    };

    function addGeoJsonToMapInternal(geoJsonData, layerId, layerName = '未命名图层') {
      let layer;
      const zIndexBase = 10; // GeoJSON 图层的基本 z-index
      const currentLayerCount = loadedGeoJsonLayers.value.length;
      console.log(`[addGeoJsonToMapInternal] 添加 "${layerName}" (ID: ${layerId}) 到 ${currentMapProvider.value}, zIndex: ${zIndexBase + currentLayerCount}`);

      if (currentMapProvider.value === 'amap') {
        if (!window.AMap || !AMap.GeoJSON) { console.error('[AMap] GeoJSON SDK 模块未加载'); return null; }
        layer = new AMap.GeoJSON({ 
          geoJSON: geoJsonData, 
          zIndex: zIndexBase + currentLayerCount,
          getMarker: (geojsonObject, lngLat) => new AMap.Marker({ position: lngLat[0], title: geoJsonObject.properties?.name || layerName, extData: { layerId } }),
          getPolyline: (geojsonObject, lngLats) => new AMap.Polyline({ path: lngLats, strokeColor: '#3388FF', strokeWeight: 4, extData: { layerId } }),
          getPolygon: (geojsonObject, lngLats) => {
             const polygon = new AMap.Polygon({
              path: lngLats,
              fillColor: '#ED6A45', // 橙色填充，类似截图
              fillOpacity: 0.6,
              strokeColor: '#fff',
              strokeWeight: 2,
              // clickable: true, // !! 关键：使面可点击
              extData: { layerId, feature: geojsonObject } // !! 关键：存储完整要素信息
            });
            queryablePolygons.push(polygon);
            if (isInfoQueryActive.value) {
              polygon.on('click', handlePolygonClick);
            }
            return polygon;
          }
        });
        
        mapInstance.value.add(layer);
      } else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') {
        const vectorSource = new VectorSource({
          features: new GeoJSON({ featureProjection: 'EPSG:3857' }).readFeatures(geoJsonData) // 假设 geoJsonData 是 EPSG:4326
        });
        layer = new VectorLayer({
          source: vectorSource,
          zIndex: zIndexBase + currentLayerCount,
          style: (feature) => {
            const geomType = feature.getGeometry().getType(); 
            let style = new Style({});
            if (geomType.includes('Point')) {
              style.setImage(new CircleStyle({ radius: 6, fill: new Fill({ color: 'rgba(255,0,0,0.7)' }), stroke: new Stroke({ color: 'red', width: 1 }) }));
            } else if (geomType.includes('LineString')) {
              style.setStroke(new Stroke({ color: '#3388FF', width: 3 }));
            } else if (geomType.includes('Polygon')) {
              style.setFill(new Fill({ color: 'rgba(51,136,255,0.3)' }));
              style.setStroke(new Stroke({ color: '#3388FF', width: 1 }));
            }
            return style;
          }
        });
        mapInstance.value.addLayer(layer);
      } else if (currentMapProvider.value === 'tencent') {
        console.warn(`[Tencent] GeoJSON 图层 "${layerName}" 的加载未针对腾讯地图完全实现。`);
        return null; 
      }
      console.log(`  图层 "${layerName}" 已成功添加到 ${currentMapProvider.value}。`);
      return layer;
    }

    const removeGeoJsonLayerById = (layerId) => {
      const layerIndex = loadedGeoJsonLayers.value.findIndex(l => l.id === layerId);
      if (layerIndex === -1) return;
      const layerToRemove = loadedGeoJsonLayers.value[layerIndex];
      try {
        if (mapInstance.value && layerToRemove.mapLayer) {
          if (currentMapProvider.value === 'amap') mapInstance.value.remove(layerToRemove.mapLayer);
          else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') mapInstance.value.removeLayer(layerToRemove.mapLayer);
          // 如果实现了腾讯地图图层移除，在此添加
        }
      } catch (e) { console.error(`从地图移除图层 ${layerId} 时出错:`, e); }
      queryablePolygons = queryablePolygons.filter(p => p.getExtData().layerId !== layerId);
      loadedGeoJsonLayers.value.splice(layerIndex, 1);
      console.log(`[LayerManager] 图层 ${layerToRemove.name} (ID: ${layerId}) 已移除。`);
    };

    const toggleGeoJsonLayerVisibilityById = (layerId) => {
      const layer = loadedGeoJsonLayers.value.find(l => l.id === layerId);
      if (!layer || !layer.mapLayer) return;
      layer.isVisible = !layer.isVisible;
      try {
        if (currentMapProvider.value === 'amap') layer.isVisible ? layer.mapLayer.show() : layer.mapLayer.hide();
        else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') layer.mapLayer.setVisible(layer.isVisible);
         // 如果实现了腾讯地图图层可见性切换，在此添加
      } catch(e){ 
        console.error(`切换图层 ${layerId} 可见性时出错:`, e); 
        layer.isVisible = !layer.isVisible; // 出错时恢复状态
      }
      console.log(`[LayerManager] 图层 ${layer.name} 可见性设置为 ${layer.isVisible}。`);
    };

    // --- 框选功能 ---
    const handleToggleBoxSelect = () => {
      if (!isBoxSelectActive.value && isInfoQueryActive.value) {
        handleToggleInfoQuery(); // 关闭点击查询
      }
      console.log('[BoxSelect] 切换点击。当前 isBoxSelectActive:', isBoxSelectActive.value);
      if (!isBoxSelectActive.value) { // 激活框选
        isBoxSelectActive.value = true;
        console.log('[BoxSelect] 激活框选。');
        if (currentMapProvider.value === 'amap') {
          if (amapMouseTool) { amapMouseTool.close(true); amapMouseTool.off('draw', handleAmapBoxDraw); }
          amapMouseTool = new AMap.MouseTool(mapInstance.value);
          amapMouseTool.on('draw', handleAmapBoxDraw);
          amapMouseTool.rectangle({ strokeColor: "#007bff", fillColor: "#007bff", fillOpacity: 0.1 });
        } else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') {
          if (olDrawInteraction) mapInstance.value.removeInteraction(olDrawInteraction);
          if (olDrawLayer) mapInstance.value.removeLayer(olDrawLayer);
          olDrawLayer = new VectorLayer({ source: new VectorSource(), style: new Style({ fill: new Fill({ color: 'rgba(0,123,255,0.1)' }), stroke: new Stroke({ color: '#007bff', width: 2 }) }), zIndex: 1000 });
          mapInstance.value.addLayer(olDrawLayer);
          olDrawInteraction = new OlDraw({ source: olDrawLayer.getSource(), type: 'Circle', geometryFunction: OlCreateBox() });
          mapInstance.value.addInteraction(olDrawInteraction);
          olDrawInteraction.on('drawend', handleOlBoxDraw);
        }
      } else { // 关闭框选
        console.log('[BoxSelect] 用户操作关闭框选。');
        isBoxSelectActive.value = false;
        if (currentMapProvider.value === 'amap') {
          if (amapMouseTool) { amapMouseTool.off('draw', handleAmapBoxDraw); amapMouseTool.close(true); amapMouseTool = null; }
        } else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') {
          if (olDrawInteraction) { mapInstance.value.removeInteraction(olDrawInteraction); olDrawInteraction = null; }
          if (olDrawLayer) { mapInstance.value.removeLayer(olDrawLayer); olDrawLayer = null; }
        }
        initMap();
      }
    };

    function handleAmapBoxDraw(event) {
      console.log('[BoxSelect][AMap] draw 事件触发。');
      const bounds = event.obj.getBounds(); // AMap.Bounds
      boxSelectAttempted.value = true;
      queryFeaturesByBounds_AMap(bounds);
      mapInstance.value.remove(event.obj); // 移除绘制的矩形
    }

    function handleOlBoxDraw(event) {
      console.log('[BoxSelect][OL] draw 事件触发。');
      const extent = event.feature.getGeometry().getExtent(); // OL Extent (EPSG:3857)
      boxSelectAttempted.value = true;
      queryFeaturesByExtent_OL(extent);
      olDrawLayer.getSource().clear(); // 从临时图层清除绘制的框
    }

    function queryFeaturesByBounds_AMap(bounds) {
      const found = [];
      loadedGeoJsonLayers.value.forEach(layer => {
        if (!layer.isVisible || !layer.processedData?.features) return;
        layer.processedData.features.forEach(feature => {
          if (!feature.geometry || !feature.geometry.coordinates) return;
          const geometryType = feature.geometry.type;
          let featureIsFound = false;
          const featureInfo = { 
            layerId: layer.id, 
            layerName: layer.name, 
            properties: feature.properties || {},
            // 关键：保存几何信息，用于后续高亮和计算
            geometry: feature.geometry 
          };
          if (geometryType === 'Point') {
            const point = new AMap.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
            if (bounds.contains(point)) {
              found.push({ layerId: layer.id, layerName: layer.name, properties: feature.properties || {} });
              featureIsFound = true;
            }
          } else if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
            const paths = geometryType === 'Polygon' 
              ? [feature.geometry.coordinates[0].map(c => new AMap.LngLat(c[0], c[1]))] 
              : feature.geometry.coordinates.map(poly => poly[0].map(c => new AMap.LngLat(c[0], c[1])));
            for (const path of paths) {
              if (new AMap.Polygon({path}).getBounds().intersects(bounds)) {
                found.push({ layerId: layer.id, layerName: layer.name, properties: feature.properties || {} });
                featureIsFound = true;
                break; 
              }
            }
            if (featureIsFound) {
              // --- 计算面积 ---
              let totalArea = 0;
              if (AMap.GeometryUtil) {
                const rings = geometryType === 'Polygon'
                  ? [feature.geometry.coordinates[0]] // [ring]
                  : feature.geometry.coordinates.map(poly => poly[0]); // [ring1, ring2, ...]
                
                rings.forEach(ringCoords => {
                  const ringPath = ringCoords.map(c => new AMap.LngLat(c[0], c[1]));
                  totalArea += AMap.GeometryUtil.ringArea(ringPath);
                });
              }
              featureInfo.area = totalArea; // 将面积（平方米）添加到信息中
            }
          } else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
            const paths = geometryType === 'LineString'
              ? [feature.geometry.coordinates.map(c => new AMap.LngLat(c[0], c[1]))]
              : feature.geometry.coordinates.map(line => line.map(c => new AMap.LngLat(c[0], c[1])));
            for (const path of paths) {
              if (new AMap.Polyline({path}).getBounds().intersects(bounds)) {
                found.push({ layerId: layer.id, layerName: layer.name, properties: feature.properties || {} });
                featureIsFound = true;
                break;
              }
            }
          }
          // if (featureIsFound) {
          //   found.push(featureInfo);
          // }
        });
      });
      selectedFeaturesInfo.value = found;
      console.log(`[QueryAMap] 找到 ${found.length} 个要素。`);
      // highlightFeaturesOnMap(found);
    }

    function queryFeaturesByExtent_OL(extent) { // extent is EPSG:3857
      const found = [];
      loadedGeoJsonLayers.value.forEach(layer => {
        if (!layer.isVisible || !layer.mapLayer?.getSource) return;
        const source = layer.mapLayer.getSource();
        if (!source.getFeaturesInExtent) return;
        source.getFeaturesInExtent(extent).forEach(f => {
          const props = {...f.getProperties()}; delete props.geometry; 
          found.push({ layerId: layer.id, layerName: layer.name, properties: props });
        });
      });
      selectedFeaturesInfo.value = found;
      console.log(`[QueryOL] 找到 ${found.length} 个要素。`);
    }

    // --- 地图初始化和切换逻辑 ---
    const loadScript = (src, id, callback) => {
      const existingScript = document.getElementById(id);
      if (existingScript) {
        console.log(`脚本 ${id} 已在 DOM 中。`);
        if (id === 'tencent-sdk' && typeof qq !== 'undefined' && qq.maps) {
          callback && callback();
        } else if (id !== 'tencent-sdk') {
          callback && callback();
        } else { 
          setTimeout(() => { if (typeof qq !== 'undefined' && qq.maps) callback && callback(); }, 200);
        }
        return;
      }
      const script = document.createElement('script'); script.src = src; script.id = id; script.async = true;
      script.onload = () => { console.log(`脚本 ${src} 已加载。`); callback && callback(); };
      script.onerror = () => { console.error(`加载脚本 ${src} 失败`); if(document.getElementById(id)) document.getElementById(id).remove(); };
      document.head.appendChild(script);
    };
    
    const destroyCurrentMap = async () => {
      console.log(`[DestroyMap] 尝试销毁提供者: "${currentMapProvider.value}". 地图就绪: ${isMapReady.value}, 实例: ${!!mapInstance.value}`);

      if (mapInstance.value && isMapReady.value) {
        let capturedCenter = null;
        let capturedZoom = null;
        try {
          // 通过实例类型推断，而不是依赖 currentMapProvider.value
          // 因为在切换流程中，currentMapProvider.value 可能已经指向新提供者
          if (window.AMap && mapInstance.value instanceof AMap.Map) {
            const amapCenter = mapInstance.value.getCenter();
            if (amapCenter) {
                capturedCenter = [amapCenter.lng, amapCenter.lat];
                capturedZoom = mapInstance.value.getZoom();
                console.log(`[DestroyMap] 正在捕获高德地图视图。`);
            }
          } else if (window.qq && window.qq.maps && mapInstance.value instanceof qq.maps.Map) {
            const tencentCenter = mapInstance.value.getCenter();
            if (tencentCenter) {
                capturedCenter = [tencentCenter.getLng(), tencentCenter.getLat()];
                capturedZoom = mapInstance.value.getZoom();
                console.log(`[DestroyMap] 正在捕获腾讯地图视图。`);
            }
          } else if (mapInstance.value instanceof OlMap) { 
            const view = mapInstance.value.getView();
            if (view) {
                const olCenter3857 = view.getCenter();
                if (olCenter3857) {
                    capturedCenter = OlTransform(olCenter3857, 'EPSG:3857', 'EPSG:4326');
                }
                capturedZoom = view.getZoom();
                console.log(`[DestroyMap] 正在捕获OpenLayers地图视图。`);
            }
          } else {
            console.warn(`[DestroyMap] 无法确定地图实例类型以捕获视图。`);
          }

          if (capturedCenter && typeof capturedZoom === 'number' && capturedCenter.every(isFinite) && isFinite(capturedZoom)) {
            lastMapView.value = { center: capturedCenter, zoom: capturedZoom };
            console.log(`[DestroyMap] 已捕获视图: 中心点 ${lastMapView.value.center.map(c => c.toFixed(5))}, 缩放 ${lastMapView.value.zoom.toFixed(2)} (EPSG:4326)`);
          } else {
            console.warn(`[DestroyMap] 无法捕获有效视图。中心点:`, capturedCenter, "缩放:", capturedZoom);
          }
        } catch (e) {
          console.error("[DestroyMap] 捕获地图视图时出错:", e);
        }
      } else {
        console.log("[DestroyMap] 地图实例不可用或未就绪，跳过视图捕获。");
      }

      isMapReady.value = false; 
      
      loadedGeoJsonLayers.value.forEach(l => {
        if (mapInstance.value && l.mapLayer) {
          try {
            // 使用实例类型判断进行移除，更可靠
            if (window.AMap && l.mapLayer instanceof AMap.GeoJSON) mapInstance.value.remove(l.mapLayer);
            else if (l.mapLayer instanceof VectorLayer) mapInstance.value.removeLayer(l.mapLayer);
            // TODO: 为腾讯地图添加特定的图层移除逻辑
            // else if (window.qq && window.qq.maps && l.mapLayer instanceof qq.maps.XXX) { /* ... */ }
            else {
                console.warn(`[DestroyMap] 未知类型的图层 ${l.name}，无法标准移除。`)
            }
          } catch (e) { console.warn(`  销毁期间移除地图图层 ${l.name} 时出错:`, e); }
        }
      });

      if (marker.value) {
        // 同样使用实例类型判断
        if (window.AMap && marker.value instanceof AMap.Marker && mapInstance.value?.remove) mapInstance.value.remove(marker.value);
        else if (marker.value instanceof OlOverlay && mapInstance.value?.removeOverlay) mapInstance.value.removeOverlay(marker.value);
        else if (window.qq && window.qq.maps && marker.value instanceof qq.maps.Marker && marker.value.setMap) marker.value.setMap(null);
        else if (marker.value?.setMap) marker.value.setMap(null);
        marker.value = null;
      }

      if (amapMouseTool) { amapMouseTool.close(true); amapMouseTool = null; }
      if (olDrawInteraction && mapInstance.value && mapInstance.value instanceof OlMap) { try { mapInstance.value.removeInteraction(olDrawInteraction); } catch(e) {console.warn("移除 OL draw interaction 时出错", e)} olDrawInteraction = null; }
      if (olDrawLayer && mapInstance.value && mapInstance.value instanceof OlMap) { try {mapInstance.value.removeLayer(olDrawLayer); } catch(e) {console.warn("移除 OL draw layer 时出错", e)} olDrawLayer = null; }
      
      if (mapInstance.value) {
        if (window.AMap && mapInstance.value instanceof AMap.Map && mapInstance.value.destroy) {
          console.log("[DestroyMap] 正在销毁高德地图实例。");
          mapInstance.value.destroy();
        } else if (window.qq && window.qq.maps && mapInstance.value instanceof qq.maps.Map && mapInstance.value.destroy) {
          console.log("[DestroyMap] 正在销毁腾讯地图实例。");
          mapInstance.value.destroy();
        } else if (mapInstance.value instanceof OlMap && mapInstance.value.setTarget) {
          console.log("[DestroyMap] 正在处理OpenLayers实例。");
          mapInstance.value.setTarget(null);
        } else {
            console.warn("[DestroyMap] 无法确定地图实例类型以进行销毁，或缺少销毁方法。");
        }
        mapInstance.value = null;
      }

      const mapContainer = document.getElementById('map-container');
      if (mapContainer) mapContainer.innerHTML = '';
      console.log(`[DestroyMap] 完成销毁。isMapReady 现在是: ${isMapReady.value}`);
    };

    const reAddAllGeoJsonLayers = () => {
      if (!isMapReady.value || !mapInstance.value) {
        console.warn("[reAddLayers] 地图未就绪，无法重新添加图层。");
        return;
      }
      const layersToReProcess = [...loadedGeoJsonLayers.value];
      loadedGeoJsonLayers.value = [];
      console.log(`[reAddLayers] 重新添加 ${layersToReProcess.length} 个图层到 ${currentMapProvider.value}`);
      
      layersToReProcess.forEach(layerInfo => {
        let dataToUseForMap = JSON.parse(JSON.stringify(layerInfo.originalData)); 
        
        if (currentMapProvider.value === 'amap' || currentMapProvider.value === 'tencent') {
          console.log(`  为 ${currentMapProvider.value} 重新转换 ${layerInfo.name}`);
          try { 
            dataToUseForMap = transformGeoJsonCoords(JSON.parse(JSON.stringify(layerInfo.originalData)), wgs84togcj02); 
          } catch (e) { 
            console.error(`  重新转换 ${layerInfo.name} 时出错:`, e);
          }
        }
        
        const newMapLayer = addGeoJsonToMapInternal(dataToUseForMap, layerInfo.id, layerInfo.name);
        if (newMapLayer) {
          loadedGeoJsonLayers.value.push({ 
            ...layerInfo, 
            processedData: dataToUseForMap, 
            mapLayer: newMapLayer 
          });
          if (!layerInfo.isVisible) {
            try {
              if (currentMapProvider.value === 'amap') newMapLayer.hide();
              else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') newMapLayer.setVisible(false);
              // TODO: 腾讯可见性
            } catch(e) { console.error(`  为重新添加的 ${layerInfo.name} 设置可见性时出错:`, e)}
          }
        } else {
          console.warn(`重新添加图层 ${layerInfo.name} 失败。它将保留在列表中但不在地图上。`);
          loadedGeoJsonLayers.value.push({ ...layerInfo, mapLayer: null, processedData: dataToUseForMap });
        }
      });
      console.log(`[reAddLayers] 完成。当前列表中的图层: ${loadedGeoJsonLayers.value.length}`);
    };

    const initMap = async () => {
      console.log(`[InitMap] 开始初始化提供者: "${currentMapProvider.value}".`);
      await destroyCurrentMap(); 
      await nextTick();

      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) { console.error("[InitMap] 未找到地图容器!"); return; }

      const targetCenter = lastMapView.value?.center || mapInitialConfigs.center;
      const targetZoom = typeof lastMapView.value?.zoom === 'number' ? lastMapView.value.zoom : mapInitialConfigs.zoom;
      console.log(`[InitMap] 目标视图 (EPSG:4326): 中心点 ${targetCenter.map(c=>c.toFixed(5))}, 缩放 ${targetZoom.toFixed(2)}`);
      
      try {
        switch (currentMapProvider.value) {
          case 'amap': await initAMap(targetCenter, targetZoom); break;
          case 'tianditu': await initTianDiTu(targetCenter, targetZoom); break;
          case 'osm': await initOSM(targetCenter, targetZoom); break;
          case 'tencent': await initTencentMap(targetCenter, targetZoom); break;
          default: console.error('[InitMap] 未知地图提供者:', currentMapProvider.value); return;
        }
        isMapReady.value = true;
        console.log(`[InitMap] "${currentMapProvider.value}" 的基础地图已初始化。isMapReady: true.`);
        
        reAddAllGeoJsonLayers(); 
        
        if (props.locationname) {
          await nextTick(); 
          searchLocation(props.locationname);
        }
        console.log(`[InitMap] 提供者 "${currentMapProvider.value}" 完全成功。`);
      } catch (error) {
        console.error(`[InitMap] 提供者 "${currentMapProvider.value}" 失败。错误:`, error);
        isMapReady.value = false;
      }
    };

    // --- 各地图初始化函数 ---
    const initAMap = async (center, zoom) => {
      console.log('[InitAMap] 初始化，中心点:', center, "缩放:", zoom);
      if(!sdkLoaded.amap) { 
        await AMapLoader.load({ 
          key: apiKeys.amap, 
          version: '2.0', 
          plugins: ['AMap.PlaceSearch', 'AMap.Geocoder', 'AMap.Marker', 'AMap.TileLayer', 'AMap.GeoJSON', 'AMap.MouseTool', 'AMap.Rectangle', 'AMap.Polygon', 'AMap.Polyline', 'AMap.GeometryUtil'] 
        }); 
        sdkLoaded.amap = true; 
      }
      mapInstance.value = new AMap.Map('map-container', {
        resizeEnable: true,
        zoom: zoom,
        center: center,
        viewMode: is3DMode.value ? '3D' : '2D'
      });
      console.log('[InitAMap] 成功。');
    };

    const initOpenLayersMapBase = async (isOSM, center, zoom) => {
      console.log(`[InitOL] 初始化 ${isOSM ? 'OSM' : 'TianDiTu'}，中心点 (EPSG:4326):`, center, "缩放:", zoom);
      const layers = [];
      const transformedCenter = OlTransform(center, 'EPSG:4326', 'EPSG:3857');
      console.log(`[InitOL] 转换后中心点 (EPSG:3857):`, transformedCenter);

      const view = new View({
        center: transformedCenter, 
        zoom: zoom,
        minZoom: 2,
        maxZoom: 18,
        constrainResolution: true,
      });
      
      if (currentMapProvider.value === 'tianditu') { 
        const key = apiKeys.tianditu; 
        layers.push(new TileLayer({source:new XYZ({url:`https://t{0-7}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${key}`,crossOrigin:'anonymous'}),zIndex:0})); 
        layers.push(new TileLayer({source:new XYZ({url:`https://t{0-7}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${key}`,crossOrigin:'anonymous'}),zIndex:1})); 
      } else if (currentMapProvider.value === 'osm') { 
        layers.push(new TileLayer({source: new XYZ({url:'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',crossOrigin:'anonymous'})})); 
      }
      
      mapInstance.value = new OlMap({ target: 'map-container', layers, view: view, controls: [] });
      console.log('[InitOL] 成功。');
    };
    const initTianDiTu = async (center, zoom) => await initOpenLayersMapBase(false, center, zoom);
    const initOSM = async (center, zoom) => await initOpenLayersMapBase(true, center, zoom);

    const initTencentMap = async (center, zoom) => {
      console.log('[InitTencent] 初始化，中心点 (EPSG:4326):', center, "缩放:", zoom);
      return new Promise((resolve, reject) => {
        const tencentMapInitHandler = () => {
          console.log('[InitTencent] tencentMapInitHandler 执行。');
          if (window.qq && window.qq.maps && window.qq.maps.Map) {
            try {
              const mapContainer = document.getElementById('map-container');
              if (!mapContainer) {
                  console.error("[InitTencent] Map container 'map-container' not found in DOM.");
                  reject(new Error("Map container 'map-container' not found."));
                  return;
              }
              mapInstance.value = new qq.maps.Map(mapContainer, {
                center: new qq.maps.LatLng(center[1], center[0]),
                zoom: zoom,
                zoomControl: false, panControl: false, mapTypeControl: false
              });
              sdkLoaded.tencent = true;
              console.log('[InitTencent] 腾讯地图实例创建成功。');
              resolve();
            } catch (e) {
              console.error("[InitTencent] 创建腾讯地图实例时出错:", e);
              sdkLoaded.tencent = false;
              reject(e);
            }
          } else {
            console.error("[InitTencent] tencentMapInitHandler: 腾讯地图 SDK 对象 (qq.maps.Map) 不可用。");
            sdkLoaded.tencent = false;
            reject(new Error('腾讯地图 SDK 对象 (qq.maps.Map) 不可用。'));
          }
          if (window.qqmap_callback === tencentMapInitHandler) {
            delete window.qqmap_callback; // 清理全局回调
            console.log('[InitTencent] 全局 qqmap_callback 已清理。');
          }
        };
        // 将 reject 函数附加到 tencentMapInitHandler 上，以便 loadScript 的 onerror 可以调用它
        tencentMapInitHandler.rejectPromise = reject; 
        window.qqmap_callback = tencentMapInitHandler;
        console.log('[InitTencent] window.qqmap_callback 已设置为 tencentMapInitHandler。');

        if (window.qq && window.qq.maps && window.qq.maps.Map) {
          console.log('[InitTencent] 腾讯地图 SDK (qq.maps.Map) 已立即可用。直接调用处理程序。');
          tencentMapInitHandler();
        } else {
          console.log('[InitTencent] 腾讯地图 SDK (qq.maps.Map) 尚不可用。将加载/重新加载脚本。');
          const existingScript = document.getElementById('tencent-sdk');
          if (existingScript) {
            console.log('[InitTencent] 发现现有腾讯地图脚本，正在移除以强制重新加载并执行回调。');
            existingScript.remove();
          }
          sdkLoaded.tencent = false; 

          loadScript(
            `https://map.qq.com/api/js?v=2.exp&key=${apiKeys.tencent}&libraries=place,drawing,geometry&callback=qqmap_callback`,
            'tencent-sdk',
            null // loadScript 的第三个参数回调对于腾讯地图不是主要初始化机制
          );
        }
      });
    };

    const searchLocation = async (locationName) => {
      if (!isMapReady.value || !mapInstance.value) { console.warn('地图未就绪，无法搜索'); return; }
      if (marker.value) {
        if (mapInstance.value?.remove && currentMapProvider.value === 'amap') mapInstance.value.remove(marker.value);
        else if (mapInstance.value?.removeOverlay && marker.value instanceof OlOverlay && (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm')) mapInstance.value.removeOverlay(marker.value);
        else if (currentMapProvider.value === 'tencent' && marker.value?.setMap) marker.value.setMap(null);
        marker.value = null;
      }
      console.log(`在 ${currentMapProvider.value} 搜索: ${locationName}`);
      if (currentMapProvider.value === 'amap') {
        if (!window.AMap || !AMap.PlaceSearch) { console.error('AMap PlaceSearch not loaded'); return; }
        const placeSearch = new AMap.PlaceSearch({ map: mapInstance.value, pageSize: 1, autoFitView: true, city: '宁波', citylimit: true });
        placeSearch.search(locationName, (status, result) => {
          if (status === 'complete' && result.poiList?.pois.length > 0) {
            const poi = result.poiList.pois[0];
            marker.value = new AMap.Marker({ position: poi.location, map: mapInstance.value, title: poi.name });
          } else console.error('高德搜索失败:', result);
        });
      } else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=1&accept-language=zh-CN,zh`);
            if (!response.ok) throw new Error(`Nominatim search failed: ${response.statusText}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const [lon, lat] = [parseFloat(data[0].lon), parseFloat(data[0].lat)];
                mapInstance.value.getView().setCenter([lon, lat]); mapInstance.value.getView().setZoom(15);
                const markerEl = document.createElement('div'); markerEl.innerHTML = '📍'; markerEl.style.cssText = 'color:red; font-size:24px; transform:translate(-50%, -100%); cursor:pointer;';
                marker.value = new OlOverlay({ position: [lon, lat], positioning: 'center-center', element: markerEl, stopEvent: false });
                mapInstance.value.addOverlay(marker.value);
                console.log(`OSM/Tianditu 搜索到 ${data[0].display_name} at [${lon}, ${lat}]`);
            } else console.error(`${currentMapProvider.value} 搜索 "${locationName}" 未找到结果。`);
        } catch (err) { console.error(`Error during ${currentMapProvider.value} search:`, err); }
      } else if (currentMapProvider.value === 'tencent') {
        if (!window.qq || !qq.maps || !qq.maps.SearchService) { console.error('Tencent SearchService not loaded'); return; }
        const searchService = new qq.maps.SearchService({
          pageCapacity: 1, autoExtend: true,
          complete: (results) => {
            if (results?.detail?.pois?.length > 0) {
              const poi = results.detail.pois[0];
              mapInstance.value.setCenter(poi.latLng); mapInstance.value.setZoom(15);
              marker.value = new qq.maps.Marker({ position: poi.latLng, map: mapInstance.value, title: poi.name });
            } else console.error('腾讯地图搜索失败:', results);
          },
          error: (err) => console.error('腾讯地图搜索服务出错:', err)
        });
        searchService.search(locationName);
      }
    };

    const switchMapProvider = async (newProvider) => {
      console.log(`[SwitchMapProvider] 请求切换到: "${newProvider}". 当前: "${currentMapProvider.value}", 就绪: ${isMapReady.value}`);
      if (currentMapProvider.value === newProvider && isMapReady.value) {
        console.log(`  无需更改。已在 "${newProvider}" 且地图已就绪。`);
        return;
      }
      
      currentMapProvider.value = newProvider;
      if (newProvider !== 'amap') is3DMode.value = false;

      console.log(`  为新提供者 "${newProvider}" 调用 initMap。`);
      await initMap();
      console.log(`[SwitchMapProvider] 为 "${newProvider}" 的 initMap 完成。isMapReady: ${isMapReady.value}`);
    };



    
    // 新增：切换信息查询模式的函数
    const handleToggleInfoQuery = () => {
      isInfoQueryActive.value = !isInfoQueryActive.value;

      if (isInfoQueryActive.value && isBoxSelectActive.value) {
        handleToggleBoxSelect(); 
      }

      const mapContainer = mapInstance.value.getContainer();
      if (isInfoQueryActive.value) {
        console.log('[InfoQuery] Activating. Binding click events to all polygons.');
        mapContainer.style.cursor = 'pointer';
        // 遍历所有已存在的多边形并绑定事件
        queryablePolygons.forEach(polygon => {
          polygon.on('click', handlePolygonClick);
        });
      } else {
        console.log('[InfoQuery] Deactivating. Unbinding click events from all polygons.');
        mapContainer.style.cursor = 'grab';
        // 遍历所有已存在的多边形并解绑事件
        queryablePolygons.forEach(polygon => {
          polygon.off('click', handlePolygonClick);
        });
        if (infoWindow.value) {
          infoWindow.value.close();
        }
      }
    };

    function handleMapClickForInfo(e) {
      // --- DEBUG START ---
      console.log('[MapClick] Map clicked!', e);
      console.log('[MapClick] Clicked target:', e.target);
      // --- DEBUG END ---

      if (infoWindow.value) {
        infoWindow.value.close();
      }

      // 检查点击的是否是我们期望的多边形
      if (e.target && e.target.CLASS_NAME === 'AMap.Polygon' && e.target.getExtData) {
        // --- DEBUG START ---
        console.log('[MapClick] Clicked on a Polygon!');
        const extData = e.target.getExtData();
        console.log('[MapClick] Polygon ExtData:', extData);
        // --- DEBUG END ---

        if (!extData || !extData.feature) {
          console.warn('[MapClick] Polygon has no extData.feature. Cannot show info window.');
          return;
        }
        
        const properties = extData.feature.properties || {};
        const path = e.target.getPath();
        const area = AMap.GeometryUtil.ringArea(path);

        // --- DEBUG START ---
        console.log(`[MapClick] Area calculated: ${area.toFixed(2)} m²`);
        // --- DEBUG END ---

        const content = `
          <div class="custom-info-window">
            <div class="info-title">${properties.name || '默认区域1'}</div>
            <div class="info-content">
              <p>面积: ${area.toFixed(2)} m²</p>
              <p class="warning-text">疑似推土区域</p>
            </div>
          </div>
        `;

        infoWindow.value = new AMap.InfoWindow({
          isCustom: true,
          content: content,
          offset: new AMap.Pixel(0, -30),
        });

        infoWindow.value.open(mapInstance.value, e.lnglat);
        console.log('[MapClick] InfoWindow opened at', e.lnglat);
      } else {
        // --- DEBUG START ---
        if (e.target) {
            console.log(`[MapClick] Clicked on something else: ${e.target.CLASS_NAME}`);
        } else {
            console.log('[MapClick] Clicked on the map base layer.');
        }
        // --- DEBUG END ---
      }
    }
    // In MultiMapRefactored.vue

function handlePolygonClick(e) {
  if (infoWindow.value) {
    infoWindow.value.close();
  }

  const polygon = e.target;
  const extData = polygon.getExtData();

  if (!extData || !extData.feature) {
    console.warn('[PolygonClick] Polygon has no extData.feature.');
    return;
  }
  
  const feature = extData.feature;
  const properties = feature.properties || {};

  // --- 关键修复：从 feature 的 geometry.coordinates 重新构建用于计算的路径 ---
  let area = 0;
  if (feature.geometry && feature.geometry.coordinates && feature.geometry.type === 'Polygon') {
    // 对于标准的 Polygon，坐标结构是 [[[lng, lat], [lng, lat], ...]]
    // 我们需要的是最里面的那个坐标数组
    const coordsForCalc = feature.geometry.coordinates[0];
    
    if (Array.isArray(coordsForCalc)) {
        // 将 [lng, lat] 数组转换为 AMap.LngLat 对象数组
        const pathForCalc = coordsForCalc.map(coord => new AMap.LngLat(coord[0], coord[1]));
        
        // 使用这个新构建的、干净的路径进行计算
        area = AMap.GeometryUtil.ringArea(pathForCalc);
        console.log(`[AreaCalc] Calculated area from feature.geometry: ${area.toFixed(2)} m²`);
    } else {
        console.error('[AreaCalc] Invalid coordinate structure for area calculation.');
    }
  } else {
    // 如果是 MultiPolygon，逻辑会更复杂，这里先处理 Polygon 的情况
    console.warn(`[AreaCalc] Geometry type is not Polygon or geometry is missing. Type: ${feature.geometry?.type}`);
  }
  // --- 修复结束 ---

  const content = `
    <div class="custom-info-window">
      <div class="info-title">${properties.name || '默认区域1'}</div>
      <div class="info-content">
        <p>面积: ${area.toFixed(2)} m²</p>
        <p class="warning-text">疑似推土区域</p>
      </div>
    </div>
  `;

  infoWindow.value = new AMap.InfoWindow({
    isCustom: true,
    content: content,
    offset: new AMap.Pixel(0, -30),
  });

  infoWindow.value.open(mapInstance.value, e.lnglat);
}


    watch(() => props.locationname, (newName) => { 
      if (newName && isMapReady.value) {
        searchLocation(newName); 
      } else if (!newName) {
        if (marker.value) {
            if (mapInstance.value?.remove && currentMapProvider.value === 'amap') mapInstance.value.remove(marker.value);
            else if (mapInstance.value?.removeOverlay && marker.value instanceof OlOverlay) mapInstance.value.removeOverlay(marker.value);
            else if (marker.value?.setMap) marker.value.setMap(null);
            marker.value = null;
        }
      }
    });

    onMounted(async () => { 
      console.log('[MultiMap] 已挂载。初始化地图...'); 
      await nextTick();
      await initMap(); 
      await provide('mapInstance', mapInstance);
    });
    
    onBeforeUnmount(() => { 
      console.log('[MultiMap] 卸载前。销毁地图...'); 
      destroyCurrentMap(); 
      if (window.qqmap_callback) delete window.qqmap_callback;
    });

    return {
      currentMapProvider, sidebarState, currentMapProviderLogo, currentMapProviderName,
      loadedGeoJsonLayers, isBoxSelectActive, selectedFeaturesInfo, boxSelectAttempted,
      openSidebarHandler, closeSidebarHandler, handleGeoJsonLoaded, handleGeoJsonError,
      switchMapProvider, removeGeoJsonLayerById, toggleGeoJsonLayerVisibilityById,
      handleToggleBoxSelect, clearFeatureSelection,isPlannerVisible,isInfoQueryActive,
      handleToggleInfoQuery,handleOpenPlannerForDrawing,
      handleOpenPlannerWithJson,
      closePlanner
    };
  },
};
</script>
<style scoped>
#map-container { width: 100%; height: 100vh; background-color: #f0f0f0; }
.map-wrapper { position: relative; width: 100%; height: 100%; }
/* Hide default map controls and logos */
:deep(.amap-logo), :deep(.amap-copyright), 
:deep(.amap-controlbar), :deep(.amap-scalecontrol), :deep(.amap-zoomcontrol) { 
  display: none !important; visibility: hidden !important; 
}
:deep(.ol-attribution), :deep(.ol-zoom), :deep(.ol-rotate), :deep(.ol-scale-line) { 
  display: none !important; visibility: hidden !important; 
}
:deep(.tdt-control-container), :deep(.tdt-control-copyright), :deep(.tdt-logo) { 
  display: none !important; visibility: hidden !important; 
}
:deep(.smnoprint), :deep(.logo_tencent), :deep(.svrctrl) { /* Tencent Maps */
  display: none !important; visibility: hidden !important; 
}
/* 处罚信息窗口 */
:deep(.custom-info-window) {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  overflow: hidden;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  width: auto;
  min-width: 200px;
}
:deep(.info-title) {
  background-color: #f8f9fa;
  padding: 10px 15px;
  font-weight: bold;
  font-size: 16px;
  border-bottom: 1px solid #dee2e6;
  color: #333;
}
:deep(.info-content) {
  padding: 15px;
  font-size: 14px;
  line-height: 1.6;
}
:deep(.info-content p) {
  margin: 0 0 5px 0;
}
:deep(.warning-text) {
  color: #d9534f;
  font-weight: bold;
}
/* 隐藏高德地图默认的信息窗体白色背景和箭头 */
:deep(.amap-info-content) {
  background: transparent;
  padding: 0;
  box-shadow: none;
}
:deep(.amap-info-sharp) {
  display: none;
}
:deep(.amap-info-close) {
  top: 10px;
  right: 10px;
  color: #888;
}
</style>