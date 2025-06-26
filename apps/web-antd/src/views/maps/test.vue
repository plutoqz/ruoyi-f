<template>
  <div class="map-wrapper relative w-full h-full">
    <div id="map-container" class="relative w-full h-full"></div>

    <div
      class="fixed top-4 left-4 flex items-center bg-white p-1.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out z-[1001]"
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
      @close-sidebar="closeSidebarHandler"
      @geojson-loaded="handleGeoJsonLoaded"
      @geojson-error="handleGeoJsonError"
      @remove-layer="removeGeoJsonLayerById"
      @toggle-layer-visibility="toggleGeoJsonLayerVisibilityById"
      @toggle-box-select="handleToggleBoxSelect"
      @clear-selection="clearFeatureSelection"
    />
  </div>
</template>

<script>
import { ref, reactive, onMounted, watch, nextTick, computed, onBeforeUnmount } from 'vue';
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

window._AMapSecurityConfig = {
  securityJsCode: '23cadd0149127f0c18ae702236f72806',
};

export default {
  name: 'MultiMapRefactored',
  components: { Sidebar },
  props: { locationname: { type: String, default: '' } },
  setup(props) {
    const mapInstance = ref(null);
    const currentMapProvider = ref('amap');
    const is3DMode = ref(false);
    const isMapReady = ref(false);
    const marker = ref(null);
    
    const loadedGeoJsonLayers = ref([]);
    let amapMouseTool = null;
    let olDrawInteraction = null;
    let olDrawLayer = null;

    const sidebarState = reactive({ isVisible: false });
    const isBoxSelectActive = ref(false);
    const selectedFeaturesInfo = ref([]);
    const boxSelectAttempted = ref(false);

    const apiKeys = { amap: '5d4d6dae7a5c65efb514bae12e669422', tianditu: '0a7965f62c288964aed9de0d459f1145', tencent: 'BLMBZ-HWKKO-UB2W4-SYIZK-MQJV7-6NFCF' };
    const mapInitialConfigs = { center: [113, 28.2], zoom: 12 };
    const sdkLoaded = reactive({ amap: false, tencent: false });
    const mapProviderNames = { amap: '高德地图', tianditu: '天地图', tencent: '腾讯地图', osm: 'OpenStreetMap' };

    const currentMapProviderLogo = computed(() => ({ amap: amapLogo, tianditu: tiandituLogo, tencent: tencentLogo, osm: osmLogo })[currentMapProvider.value] || '');
    const currentMapProviderName = computed(() => mapProviderNames[currentMapProvider.value] || '未知地图');

    const openSidebarHandler = () => sidebarState.isVisible = true;
    const closeSidebarHandler = () => sidebarState.isVisible = false;

    const clearFeatureSelection = () => {
      selectedFeaturesInfo.value = [];
      boxSelectAttempted.value = false;
      if (currentMapProvider.value === 'amap' && amapMouseTool) {
        amapMouseTool.close(true);
      }
      if ((currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') && olDrawLayer) {
        olDrawLayer.getSource().clear();
      }
    };

    const handleGeoJsonLoaded = (payload) => {
      console.log('[MultiMap] handleGeoJsonLoaded received payload:', payload ? {name: payload.name, type: typeof payload.data} : payload);
      if (!payload || typeof payload.name !== 'string' || !payload.data) {
        console.error('[MultiMap] Invalid or incomplete payload for geojson-loaded. Payload:', payload);
        alert('导入 GeoJSON 失败：数据传递错误。');
        return;
      }
      const { name, data: originalGeoJsonData } = payload;
      if (!mapInstance.value || !isMapReady.value) {
        console.error('[MultiMap] Map not ready for GeoJSON load.');
        alert('地图未加载，请稍后再试。');
        return;
      }
      console.log(`[MultiMap] Processing GeoJSON: ${name}`);
      let processedData = JSON.parse(JSON.stringify(originalGeoJsonData));
      if (currentMapProvider.value === 'amap' || currentMapProvider.value === 'tencent') {
        console.log(`  Transforming coordinates for ${currentMapProvider.value}`);
        try {
            processedData = transformGeoJsonCoords(processedData, wgs84togcj02);
        } catch (e) {
            console.error("  Coordinate transformation failed:", e);
            alert(`图层 "${name}" 坐标转换失败。`);
        }
      }
      const layerId = uuidv4();
      const mapLayerObject = addGeoJsonToMapInternal(processedData, layerId, name);
      if (mapLayerObject) {
        loadedGeoJsonLayers.value.push({
          id: layerId, name: name || `未命名图层-${layerId.substring(0,4)}`,
          originalData: originalGeoJsonData, processedData: processedData,
          mapLayer: mapLayerObject, isVisible: true,
        });
      } else {
        console.error(`[MultiMap] Failed to add layer "${name}" to map.`);
        alert(`图层 "${name}" 添加失败。`);
      }
    };
    
    const handleGeoJsonError = (errorMessage) => {
        console.error('[MultiMap] Received geojson-error:', errorMessage);
        alert(`GeoJSON 导入失败: ${errorMessage}`);
    };

    function addGeoJsonToMapInternal(geoJsonData, layerId, layerName = '未命名图层') {
      // ... (内容与之前版本类似，确保日志清晰)
      let layer;
      const zIndexBase = 10; 
      const currentLayerCount = loadedGeoJsonLayers.value.length;
      console.log(`[addGeoJsonToMapInternal] Adding "${layerName}" (ID: ${layerId}) to ${currentMapProvider.value}, zIndex: ${zIndexBase + currentLayerCount}`);

      if (currentMapProvider.value === 'amap') {
        if (!window.AMap || !AMap.GeoJSON) { console.error('[AMap] GeoJSON SDK not loaded'); return null; }
        layer = new AMap.GeoJSON({ geoJSON: geoJsonData, zIndex: zIndexBase + currentLayerCount, 
            getMarker: (g,l) => new AMap.Marker({position:l[0], title:g.properties?.name||layerName, extData:{layerId}}), 
            getPolyline: (g,l) => new AMap.Polyline({path:l, strokeColor:'#3388FF', strokeWeight:4, extData:{layerId}}), 
            getPolygon: (g,l) => new AMap.Polygon({path:l, fillColor:'#3388FF', fillOpacity:0.35, extData:{layerId}})
        });
        mapInstance.value.add(layer);
      } else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') {
        const vectorSource = new VectorSource({ features: new GeoJSON().readFeatures(geoJsonData) });
        layer = new VectorLayer({ source: vectorSource, zIndex: zIndexBase + currentLayerCount, 
            style: (f) => {
                const geomType = f.getGeometry().getType(); let s = new Style({});
                if (geomType.includes('Point')) s.setImage(new CircleStyle({radius:6,fill:new Fill({color:'rgba(255,0,0,0.7)'})}));
                else if (geomType.includes('LineString')) s.setStroke(new Stroke({color:'#3388FF',width:3}));
                else if (geomType.includes('Polygon')) {s.setFill(new Fill({color:'rgba(51,136,255,0.3)'})); s.setStroke(new Stroke({color:'#3388FF',width:1}));}
                return s;
            }
        });
        mapInstance.value.addLayer(layer);
      } else if (currentMapProvider.value === 'tencent') {
        console.warn(`[Tencent] GeoJSON layer "${layerName}" load not fully implemented.`); return null;
      }
      console.log(`  Layer "${layerName}" added successfully.`);
      return layer;
    }

    const removeGeoJsonLayerById = (layerId) => { /* ... (与之前版本类似) ... */ 
        const layerIndex = loadedGeoJsonLayers.value.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return;
        const layerToRemove = loadedGeoJsonLayers.value[layerIndex];
        try {
            if (mapInstance.value && layerToRemove.mapLayer) {
            if (currentMapProvider.value === 'amap') mapInstance.value.remove(layerToRemove.mapLayer);
            else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') mapInstance.value.removeLayer(layerToRemove.mapLayer);
            }
        } catch (e) { console.error(`Error removing layer ${layerId} from map:`, e); }
        loadedGeoJsonLayers.value.splice(layerIndex, 1);
        console.log(`[LayerManager] Layer ${layerToRemove.name} (ID: ${layerId}) removed.`);
    };

    const toggleGeoJsonLayerVisibilityById = (layerId) => { /* ... (与之前版本类似) ... */ 
        const layer = loadedGeoJsonLayers.value.find(l => l.id === layerId);
        if (!layer || !layer.mapLayer) return;
        layer.isVisible = !layer.isVisible;
        try {
            if (currentMapProvider.value === 'amap') layer.isVisible ? layer.mapLayer.show() : layer.mapLayer.hide();
            else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') layer.mapLayer.setVisible(layer.isVisible);
        } catch(e){ console.error(`Error toggling visibility for layer ${layerId}:`, e); layer.isVisible = !layer.isVisible; }
        console.log(`[LayerManager] Layer ${layer.name} visibility set to ${layer.isVisible}.`);
    };

    const handleToggleBoxSelect = () => { /* ... (与之前版本类似) ... */ 
        isBoxSelectActive.value = !isBoxSelectActive.value;
        clearFeatureSelection();
        console.log(`[BoxSelect] Toggled to: ${isBoxSelectActive.value}`);
        if (isBoxSelectActive.value) {
            if (currentMapProvider.value === 'amap') { /* ... */ if (!amapMouseTool) { amapMouseTool = new AMap.MouseTool(mapInstance.value); amapMouseTool.on('draw', handleAmapBoxDraw); } amapMouseTool.rectangle({ strokeColor:"#007bff",fillColor:"#007bff",fillOpacity:0.1}); }
            else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') { /* ... */ if (!olDrawLayer) { olDrawLayer = new VectorLayer({source: new VectorSource(), style: new Style({fill:new Fill({color:'rgba(0,123,255,0.1)'}),stroke:new Stroke({color:'#007bff',width:2})}), zIndex:1000}); mapInstance.value.addLayer(olDrawLayer); } if (olDrawInteraction) mapInstance.value.removeInteraction(olDrawInteraction); olDrawInteraction = new OlDraw({source:olDrawLayer.getSource(),type:'Circle',geometryFunction:OlCreateBox()}); mapInstance.value.addInteraction(olDrawInteraction); olDrawInteraction.on('drawend', handleOlBoxDraw); }
        } else {
            if (amapMouseTool) amapMouseTool.close(false);
            if (olDrawInteraction && mapInstance.value) mapInstance.value.removeInteraction(olDrawInteraction);
        }
    };
    function handleAmapBoxDraw(event) { /* ... (与之前版本类似) ... */ 
        const bounds = event.obj.getBounds(); boxSelectAttempted.value = true; queryFeaturesByBounds_AMap(bounds); amapMouseTool.close(true); isBoxSelectActive.value = false;
        console.log('[BoxSelect] AMap draw complete.');
    }
    function handleOlBoxDraw(event) { /* ... (与之前版本类似) ... */ 
        const extent = event.feature.getGeometry().getExtent(); boxSelectAttempted.value = true; queryFeaturesByExtent_OL(extent); if (olDrawLayer) olDrawLayer.getSource().clear(); if (olDrawInteraction) mapInstance.value.removeInteraction(olDrawInteraction); olDrawInteraction = null; isBoxSelectActive.value = false;
        console.log('[BoxSelect] OpenLayers draw complete.');
    }
    function queryFeaturesByBounds_AMap(bounds) { /* ... (与之前版本类似) ... */ 
        const found = [];
        loadedGeoJsonLayers.value.forEach(layer => {
            if (!layer.isVisible || !layer.processedData?.features) return;
            layer.processedData.features.forEach(feature => {
                if (feature.geometry?.type === 'Point' && bounds.contains(new AMap.LngLat(feature.geometry.coordinates[0], feature.geometry.coordinates[1]))) {
                    found.push({ layerId: layer.id, layerName: layer.name, properties: feature.properties || {} });
                }
            });
        });
        selectedFeaturesInfo.value = found;
        console.log(`[QueryAMap] Found ${found.length} features.`);
    }
    function queryFeaturesByExtent_OL(extent) { /* ... (与之前版本类似) ... */ 
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
        console.log(`[QueryOL] Found ${found.length} features.`);
    }

    const loadScript = (src, id, callback) => { /* ... (与之前版本类似) ... */ 
        const existingScript = document.getElementById(id);
        if (existingScript) {
            let attempts = 0; const check = () => {
                if (id === 'tencent-sdk' && window.qq && window.qq.maps) callback && callback();
                else if (id !== 'tencent-sdk') callback && callback();
                else if (attempts < 30) { attempts++; setTimeout(check, 100); }
                else { console.warn(`SDK ${id} exists but not ready.`); callback && callback(); }
            }; check(); return;
        }
        const script = document.createElement('script'); script.src = src; script.id = id; script.async = true;
        script.onload = () => {console.log(`Script ${src} loaded.`); callback && callback();}; 
        script.onerror = () => {console.error(`Failed to load script ${src}`); if(document.getElementById(id)) document.getElementById(id).remove();};
        document.head.appendChild(script);
    };

    const destroyCurrentMap = async () => {
      console.log(`[DestroyMap] START for provider: "${currentMapProvider.value}". isMapReady: ${isMapReady.value}`);
      isMapReady.value = false; // Set this at the very beginning
      
      loadedGeoJsonLayers.value.forEach(l => {
        if (mapInstance.value && l.mapLayer) {
          try {
            if (currentMapProvider.value === 'amap') mapInstance.value.remove(l.mapLayer);
            else if (currentMapProvider.value === 'tencent') { if (Array.isArray(l.mapLayer)) l.mapLayer.forEach(o => o.setMap(null)); else if (l.mapLayer.setMap) l.mapLayer.setMap(null); }
            else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') mapInstance.value.removeLayer(l.mapLayer);
          } catch (e) { console.warn(`  Error removing map layer ${l.name} during destroy:`, e); }
        }
      });
      if (marker.value) { /* ... */ 
        if (mapInstance.value?.remove && currentMapProvider.value === 'amap') mapInstance.value.remove(marker.value);
        else if (mapInstance.value?.removeOverlay && marker.value instanceof OlOverlay) mapInstance.value.removeOverlay(marker.value);
        else if (marker.value?.setMap) marker.value.setMap(null);
        marker.value = null;
      }
      if (amapMouseTool) { amapMouseTool.close(true); amapMouseTool = null; }
      if (olDrawInteraction && mapInstance.value) { mapInstance.value.removeInteraction(olDrawInteraction); olDrawInteraction = null; }
      if (olDrawLayer && mapInstance.value) { mapInstance.value.removeLayer(olDrawLayer); olDrawLayer = null; }

      if (mapInstance.value) {
        if ((currentMapProvider.value === 'amap' || currentMapProvider.value === 'tencent') && mapInstance.value.destroy) mapInstance.value.destroy();
        else if ((currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') && mapInstance.value.setTarget) mapInstance.value.setTarget(null);
        mapInstance.value = null;
      }
      const mapContainer = document.getElementById('map-container');
      if (mapContainer) mapContainer.innerHTML = '';
      console.log(`[DestroyMap] FINISHED. isMapReady is now: ${isMapReady.value}`);
    };

    const reAddAllGeoJsonLayers = () => { /* ... (与之前版本类似) ... */ 
        const layersToReProcess = [...loadedGeoJsonLayers.value];
        loadedGeoJsonLayers.value = []; 
        console.log(`[reAddLayers] Re-adding ${layersToReProcess.length} layers to ${currentMapProvider.value}`);
        layersToReProcess.forEach(layerInfo => {
            let dataToLoad = JSON.parse(JSON.stringify(layerInfo.originalData));
            if (currentMapProvider.value === 'amap' || currentMapProvider.value === 'tencent') {
                try { dataToLoad = transformGeoJsonCoords(dataToLoad, wgs84togcj02); } catch (e) { console.error(`  Error transforming ${layerInfo.name} for re-add:`, e) }
            }
            const newMapLayer = addGeoJsonToMapInternal(dataToLoad, layerInfo.id, layerInfo.name);
            if (newMapLayer) {
                loadedGeoJsonLayers.value.push({ ...layerInfo, processedData: dataToLoad, mapLayer: newMapLayer });
                if (!layerInfo.isVisible) { 
                    try {
                        if (currentMapProvider.value === 'amap') newMapLayer.hide();
                        else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') newMapLayer.setVisible(false);
                    } catch(e) { console.error(`  Error setting visibility for re-added ${layerInfo.name}:`, e)}
                }
            }
        });
        console.log(`[reAddLayers] Finished. Current layers: ${loadedGeoJsonLayers.value.length}`);
    };

    const initMap = async () => {
      console.log(`[InitMap] START for provider: "${currentMapProvider.value}". Current isMapReady: ${isMapReady.value}`);
      await destroyCurrentMap();
      await nextTick();
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) { console.error("[InitMap] Map container not found!"); return; }
      mapContainer.innerHTML = '';
      try {
        switch (currentMapProvider.value) {
          case 'amap': await initAMap(); break;
          case 'tianditu': await initTianDiTu(); break;
          case 'osm': await initOSM(); break;
          case 'tencent': await initTencentMap(); break;
          default: console.error('[InitMap] Unknown map provider:', currentMapProvider.value); return;
        }
        isMapReady.value = true; // Set ready before re-adding layers
        console.log(`[InitMap] Base map for "${currentMapProvider.value}" initialized. isMapReady: true.`);
        reAddAllGeoJsonLayers();
        if (props.locationname) {
          await nextTick(); // Ensure map is fully settled before search
          searchLocation(props.locationname);
        }
        console.log(`[InitMap] FULL SUCCESS for provider: "${currentMapProvider.value}".`);
      } catch (error) {
        console.error(`[InitMap] FAILED for provider: "${currentMapProvider.value}". Error:`, error);
        isMapReady.value = false;
      }
    };

    const initAMap = async () => { /* ... (与之前版本类似, 确保插件列表正确) ... */ 
        console.log('[InitAMap] Initializing...');
        if(!sdkLoaded.amap) { await AMapLoader.load({ key: apiKeys.amap, version: '2.0', plugins: ['AMap.PlaceSearch', 'AMap.Geocoder', 'AMap.Marker', 'AMap.TileLayer', 'AMap.GeoJSON', 'AMap.MouseTool', 'AMap.Rectangle', 'AMap.Polygon', 'AMap.Polyline', 'AMap.GeometryUtil'] }); sdkLoaded.amap = true; }
        mapInstance.value = new AMap.Map('map-container', { resizeEnable: true, zoom: mapInitialConfigs.zoom, center: mapInitialConfigs.center, viewMode: is3DMode.value ? '3D' : '2D' });
        console.log('[InitAMap] Success.');
    };
    const initOpenLayersMapBase = async (isOSM = false) => { /* ... (与之前版本类似) ... */ 
        console.log(`[InitOL] Initializing ${isOSM ? 'OSM' : 'TianDiTu'}...`);
        const layers = [];
        if (currentMapProvider.value === 'tianditu') { const key = apiKeys.tianditu; layers.push(new TileLayer({source:new XYZ({url:`https://t{0-7}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${key}`,crossOrigin:'anonymous'}),zIndex:0})); layers.push(new TileLayer({source:new XYZ({url:`https://t{0-7}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${key}`,crossOrigin:'anonymous'}),zIndex:1})); }
        else if (currentMapProvider.value === 'osm') { layers.push(new TileLayer({source: new XYZ({url:'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',crossOrigin:'anonymous'})})); }
        mapInstance.value = new OlMap({ target: 'map-container', layers, view: new View({ center: OlTransform(mapInitialConfigs.center, 'EPSG:4326', 'EPSG:3857'), zoom: mapInitialConfigs.zoom, projection: 'EPSG:3857'}), controls: [] });
        console.log('[InitOL] Success.');
    };
    const initTianDiTu = async () => await initOpenLayersMapBase(false);
    const initOSM = async () => await initOpenLayersMapBase(true);
    const initTencentMap = async () => { /* ... (与之前版本类似, 确保库加载正确) ... */ 
        console.log('[InitTencent] Initializing...');
        return new Promise((resolve, reject) => {
            window.qqmap_callback = () => { try { if(!qq?.maps?.Map) {reject(new Error('Tencent SDK not ready')); return;} sdkLoaded.tencent = true; mapInstance.value = new qq.maps.Map(document.getElementById('map-container'), {center:new qq.maps.LatLng(mapInitialConfigs.center[1],mapInitialConfigs.center[0]),zoom:mapInitialConfigs.zoom,zoomControl:false,panControl:false,mapTypeControl:false}); console.log('[InitTencent] Success.'); resolve(); } catch (e) {sdkLoaded.tencent=false; reject(e);} };
            if(!document.getElementById('tencent-sdk') || !sdkLoaded.tencent) { loadScript( `https://map.qq.com/api/js?v=2.exp&key=${apiKeys.tencent}&libraries=place,drawing,geometry&callback=qqmap_callback`, 'tencent-sdk', null ); }
            else { if (window.qq?.maps) window.qqmap_callback(); else reject(new Error("Tencent SDK script exists but qq.maps not available."));}
        });
    };

    const searchLocation = async (locationName) => { /* ... (与之前版本类似) ... */ 
        if (!isMapReady.value || !mapInstance.value) return;
        console.log(`[SearchLocation] Searching for "${locationName}" on ${currentMapProvider.value}`);
        // ... (clear old marker) ...
        if (currentMapProvider.value === 'amap') { /* ... */ }
        else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') { /* ... */ }
        else if (currentMapProvider.value === 'tencent') { /* ... */ }
    };
    
    const switchMapProvider = async (newProvider) => {
      console.log(`[SwitchMapProvider] Request to switch to: "${newProvider}". Current: "${currentMapProvider.value}", Ready: ${isMapReady.value}`);
      if (currentMapProvider.value === newProvider && isMapReady.value) {
        console.log(`  No change needed. Already on "${newProvider}" and map is ready.`);
        return;
      }
      if (currentMapProvider.value === newProvider && !isMapReady.value) {
        console.log(`  Re-initializing current provider "${newProvider}" as map was not ready.`);
      } else {
        console.log(`  Switching from "${currentMapProvider.value}" to "${newProvider}".`);
      }
      
      currentMapProvider.value = newProvider;
      if (newProvider !== 'amap') is3DMode.value = false;
      
      console.log(`  Calling initMap for "${newProvider}".`);
      await initMap();
      console.log(`[SwitchMapProvider] initMap for "${newProvider}" finished. isMapReady: ${isMapReady.value}`);
    };

    watch(() => props.locationname, (newName) => { if (newName && isMapReady.value) searchLocation(newName); });
    onMounted(async () => { console.log('[MultiMap] Mounted. Initializing map...'); await nextTick(); await initMap(); });
    onBeforeUnmount(() => { console.log('[MultiMap] BeforeUnmount. Destroying map...'); destroyCurrentMap(); if (window.qqmap_callback) delete window.qqmap_callback; });

    return {
      currentMapProvider, sidebarState, currentMapProviderLogo, currentMapProviderName,
      loadedGeoJsonLayers, isBoxSelectActive, selectedFeaturesInfo, boxSelectAttempted,
      openSidebarHandler, closeSidebarHandler, handleGeoJsonLoaded, handleGeoJsonError,
      switchMapProvider, removeGeoJsonLayerById, toggleGeoJsonLayerVisibilityById,
      handleToggleBoxSelect, clearFeatureSelection,
    };
  },
};
</script>

<style scoped>
#map-container { width: 100%; height: 100vh; background-color: #f0f0f0; }
.map-wrapper { position: relative; width: 100%; height: 100%; }
:deep(.amap-logo), :deep(.amap-copyright), :deep(.amap-controlbar), :deep(.amap-scalecontrol), :deep(.amap-zoomcontrol) { display: none !important; visibility: hidden !important; }
:deep(.ol-attribution), :deep(.ol-zoom), :deep(.ol-rotate), :deep(.ol-scale-line) { display: none !important; visibility: hidden !important; }
:deep(.tdt-control-container), :deep(.tdt-control-copyright), :deep(.tdt-logo) { display: none !important; visibility: hidden !important; }
:deep(.smnoprint), :deep(.logo_tencent), :deep(.svrctrl) { display: none !important; visibility: hidden !important; }
</style>