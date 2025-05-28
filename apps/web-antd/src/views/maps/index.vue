<template>
  <div class="map-wrapper relative w-full h-full">
    <div id="map-container" class="relative w-full h-full"></div>

    <div
      class="absolute top-6 left-6 flex items-center bg-white p-1.5 rounded-full shadow-sm hover:shadow-md transition-all duration-300 ease-in-out"
      :class="{ 'opacity-0 pointer-events-none': sidebarState.isVisible, 'opacity-100': !sidebarState.isVisible }"
    >
      <button
        @click="openSidebarHandler"
        class="group flex flex-col space-y-1.5 map-controls-wrapper p-1.5 rounded-full hover:bg-gray-100 transition-all duration-300 ease-in-out"
        title="打开侧边栏"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="feather feather-align-justify text-gray-700 group-hover:text-blue-500 transition-colors duration-300 ease-in-out"
        >
          <line x1="21" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="6" x2="3" y2="6"></line>
          <line x1="21" y1="18" x2="3" y2="18"></line>
        </svg>
      </button>

      <select
        :value="currentMapProvider" @change="switchMapProvider($event.target.value)" class="bg-white text-gray-700 py-1 px-3 rounded-full appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-white transition-all duration-300 ease-in-out cursor-pointer hover:shadow-sm"
        title="切换地图源"
      >
        <option value="amap" style="text-align: center;">高德地图</option>
        <option value="tianditu" style="text-align: center;">天地图</option>
        <option value="tencent" style="text-align: center;">腾讯地图</option>
        <option value="osm" style="text-align: center;">OpenStreetMap</option>
      </select>
    </div>

    <Sidebar
      :is-visible="sidebarState.isVisible"
      :provider-logo="currentMapProviderLogo"
      :provider-name="currentMapProviderName"
      @close-sidebar="closeSidebarHandler"
      @geojson-loaded="handleGeoJsonLoaded"
      @geojson-error="handleGeoJsonError"
    />
  </div>
</template>

<script>
// 从 'vue' 导入 onBeforeUnmount
import { ref, reactive, onMounted, watch, nextTick, computed, onBeforeUnmount } from 'vue';
import AMapLoader from '@amap/amap-jsapi-loader';
import { Map as OlMap, View, Overlay as OlOverlay } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import XYZ from 'ol/source/XYZ';

import Sidebar from './Sidebar.vue';

// Logo 图片导入 (请确保路径正确或使用更通用的方式如 public 目录或 assets 别名)
import amapLogo from 'E:/vscode/my-ruoyi-admin-webgis/ruoyi-admin/gaodeLogo.png';
import tiandituLogo from 'E:/vscode/my-ruoyi-admin-webgis/ruoyi-admin/tianditu.png';
import tencentLogo from 'E:/vscode/my-ruoyi-admin-webgis/ruoyi-admin/tencent.png';
import osmLogo from 'E:/vscode/my-ruoyi-admin-webgis/ruoyi-admin/osm.png';

window._AMapSecurityConfig = {
  securityJsCode: '23cadd0149127f0c18ae702236f72806',
};

export default {
  name: 'MultiMapRefactored',
  components: {
    Sidebar,
  },
  props: {
    locationname: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const mapInstance = ref(null);
    const currentMapProvider = ref('amap'); // 初始地图源
    const is3DMode = ref(false);
    const isMapReady = ref(false);
    const marker = ref(null);
    const geojsonLayer = ref(null);

    const sidebarState = reactive({
      isVisible: false,
    });

    const apiKeys = {
      amap: '5d4d6dae7a5c65efb514bae12e669422',
      tianditu: '0a7965f62c288964aed9de0d459f1145',
      tencent: 'BLMBZ-HWKKO-UB2W4-SYIZK-MQJV7-6NFCF',
    };
    const mapInitialConfigs = {
      center: [113, 28.2],
      zoom: 12,
    };
    const sdkLoaded = reactive({
      amap: false,
      tencent: false,
    });

    const mapProviderNames = {
        amap: '高德地图',
        tianditu: '天地图',
        tencent: '腾讯地图',
        osm: 'OpenStreetMap',
    };

    const currentMapProviderLogo = computed(() => {
      const logos = {
        amap: amapLogo,
        tianditu: tiandituLogo,
        tencent: tencentLogo,
        osm: osmLogo,
      };
      return logos[currentMapProvider.value] || '';
    });

    const currentMapProviderName = computed(() => {
        return mapProviderNames[currentMapProvider.value] || '未知地图';
    });

    const openSidebarHandler = () => {
      sidebarState.isVisible = true;
    };
    const closeSidebarHandler = () => {
      sidebarState.isVisible = false;
    };

    const handleGeoJsonLoaded = (geojsonData) => {
      console.log('父组件收到 GeoJSON 数据:', geojsonData);
      if (!mapInstance.value || !isMapReady.value) {
        console.error('地图实例未就绪，无法加载 GeoJSON。');
        return;
      }
      loadGeoJsonToMap(geojsonData);
    };

    const handleGeoJsonError = (errorMessage) => {
      console.error('GeoJSON 导入错误:', errorMessage);
    };

    const loadGeoJsonToMap = (geojsonData) => {
      if (geojsonLayer.value) {
        try {
            if (currentMapProvider.value === 'amap' && mapInstance.value?.remove) {
                mapInstance.value.remove(geojsonLayer.value);
            } else if ((currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') && mapInstance.value?.removeLayer) {
                mapInstance.value.removeLayer(geojsonLayer.value);
            }
        } catch(e) {
            console.warn("移除旧 GeoJSON 图层时出错:", e);
        }
        geojsonLayer.value = null;
        console.log('已移除现有 GeoJSON 图层。');
      }

      console.log(`正在将 GeoJSON 数据添加到 ${currentMapProvider.value} 地图...`);
      if (currentMapProvider.value === 'amap') {
        if (!window.AMap || !AMap.GeoJSON) { console.error('高德地图 GeoJSON SDK 未加载'); return; }
        geojsonLayer.value = new AMap.GeoJSON({
          geoJSON: geojsonData,
          getMarker: (geojson, lnglats) => {
            const properties = geojson.properties || {}; const style = properties.style || {};
            return new AMap.Marker({
              position: lnglats[0],
              icon: new AMap.Icon({
                image: style.iconUrl || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="' + (style.color || '#FF3300') + '" stroke="white" stroke-width="2"/></svg>',
                size: new AMap.Size(style.iconWidth || 20, style.iconHeight || 20),
                imageSize: new AMap.Size(style.iconWidth || 20, style.iconHeight || 20)
              }),
              offset: new AMap.Pixel(-(style.iconWidth || 20)/2, -(style.iconHeight || 20)),
              title: properties.name || 'GeoJSON点'
            });
          },
          getPolyline: (geojson, lnglats) => new AMap.Polyline({ path: lnglats, strokeColor: (geojson.properties?.style?.strokeColor || '#0066FF'), strokeWeight: (geojson.properties?.style?.strokeWeight || 4), strokeOpacity: (geojson.properties?.style?.strokeOpacity || 0.9), lineJoin: (geojson.properties?.style?.lineJoin ||'round') }),
          getPolygon: (geojson, lnglats) => new AMap.Polygon({ path: lnglats, fillColor: (geojson.properties?.style?.fillColor || '#FF3300'), fillOpacity: (geojson.properties?.style?.fillOpacity || 0.35), strokeColor: (geojson.properties?.style?.strokeColor || '#FFFFFF'), strokeWeight: (geojson.properties?.style?.strokeWeight || 2), strokeOpacity: (geojson.properties?.style?.strokeOpacity || 0.8)})
        });
        mapInstance.value.add(geojsonLayer.value);
        console.log('GeoJSON 已添加到高德地图');
      } else if (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') {
        const vectorSource = new VectorSource({
          features: new GeoJSON().readFeatures(geojsonData, {
            // dataProjection: 'EPSG:4326', // 假设GeoJSON数据是EPSG:4326
            // featureProjection: mapInstance.value.getView().getProjection().getCode() // 转换到地图视图的投影
          }),
        });
        geojsonLayer.value = new VectorLayer({
          source: vectorSource,
          style: function(feature) {
            const geomType = feature.getGeometry().getType();
            const styleProps = feature.getProperties().style || {};
            let style = new Style({});
            if (geomType === 'Point' || geomType === 'MultiPoint') {
              style.setImage(new CircleStyle({
                radius: styleProps.radius || 7,
                fill: new Fill({ color: styleProps.fillColor || 'rgba(255,0,0,0.6)' }),
                stroke: new Stroke({ color: styleProps.strokeColor || 'white', width: styleProps.strokeWidth || 2 }),
              }));
            } else if (geomType === 'LineString' || geomType === 'MultiLineString') { style.setStroke(new Stroke({ color: styleProps.strokeColor || 'blue', width: styleProps.strokeWeight || 3 }));
            } else if (geomType === 'Polygon' || geomType === 'MultiPolygon') { style.setFill(new Fill({ color: styleProps.fillColor || 'rgba(255,0,0,0.3)' })); style.setStroke(new Stroke({ color: styleProps.strokeColor || 'red', width: styleProps.strokeWeight || 1 }));
            }
            return style;
          }
        });
        mapInstance.value.addLayer(geojsonLayer.value);
        console.log('GeoJSON 已添加到 OpenLayers 地图');
      } else if (currentMapProvider.value === 'tencent') {
        console.warn('腾讯地图的 GeoJSON 加载功能尚未在此示例中完全实现。');
      }
    };

    const loadScript = (src, id, callback) => {
        const existingScript = document.getElementById(id);
        if (existingScript) {
            console.log(`脚本 ${id} 已存在.`);
            let attempts = 0;
            const checkSdkReady = () => {
                if (id === 'tencent-sdk' && window.qq && window.qq.maps) {
                    if (callback) callback();
                } else if (id !== 'tencent-sdk') { // For non-Tencent scripts, assume ready if element exists
                    if (callback) callback();
                } else if (attempts < 20) { // For Tencent, retry if qq.maps not ready
                    attempts++;
                    setTimeout(checkSdkReady, 100);
                } else {
                    console.warn(`脚本 ${id} 已存在但SDK对象在超时后仍未就绪.`);
                    if (callback) callback(); // Proceed, hoping it becomes available or error is handled
                }
            };
            checkSdkReady();
            return;
        }
        const script = document.createElement('script');
        script.src = src; script.id = id; script.async = true;
        script.onload = () => { console.log(`脚本 ${src} 加载成功`); if (callback) callback(); };
        script.onerror = () => { console.error(`加载脚本 ${src} 失败`); if(document.getElementById(id)) document.getElementById(id).remove(); };
        document.head.appendChild(script);
    };

    const destroyCurrentMap = async () => {
      isMapReady.value = false;
      console.log(`开始销毁地图: ${currentMapProvider.value || '无'}`);
      if (geojsonLayer.value) {
        if (mapInstance.value?.remove && currentMapProvider.value === 'amap') mapInstance.value.remove(geojsonLayer.value);
        else if (mapInstance.value?.removeLayer && (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm')) mapInstance.value.removeLayer(geojsonLayer.value);
        geojsonLayer.value = null;
      }
      if (marker.value) {
        if (mapInstance.value?.remove && currentMapProvider.value === 'amap') mapInstance.value.remove(marker.value);
        else if (mapInstance.value?.removeOverlay && marker.value instanceof OlOverlay && (currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm')) mapInstance.value.removeOverlay(marker.value);
        else if (currentMapProvider.value === 'tencent' && marker.value?.setMap) marker.value.setMap(null);
        marker.value = null;
      }
      if (mapInstance.value) {
        if ((currentMapProvider.value === 'amap' || currentMapProvider.value === 'tencent') && mapInstance.value.destroy) {
          mapInstance.value.destroy();
        } else if ((currentMapProvider.value === 'tianditu' || currentMapProvider.value === 'osm') && mapInstance.value.setTarget) {
          mapInstance.value.setTarget(null);
        }
        mapInstance.value = null;
      }
      const mapContainer = document.getElementById('map-container');
      if (mapContainer) mapContainer.innerHTML = '';
    };

    const initMap = async () => {
      console.log(`准备初始化地图: ${currentMapProvider.value}`);
      await destroyCurrentMap();
      await nextTick();
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) { console.error("地图容器 'map-container' 未在DOM中找到!"); return; }
      mapContainer.innerHTML = '';
      try {
        switch (currentMapProvider.value) {
          case 'amap': await initAMap(); break;
          case 'tianditu': await initTianDiTu(); break;
          case 'osm': await initOSM(); break;
          case 'tencent': await initTencentMap(); break;
          default: console.error('未知的地图提供商:', currentMapProvider.value); return;
        }
        isMapReady.value = true;
        console.log(`${currentMapProvider.value} 地图初始化流程完成.`);
        if (props.locationname) {
          await nextTick();
          searchLocation(props.locationname);
        }
      } catch (error) {
        console.error(`初始化地图 ${currentMapProvider.value} 失败:`, error);
        isMapReady.value = false;
      }
    };

    const initAMap = async () => {
      console.log('初始化高德地图 (AMap)...');
      try {
        if (!sdkLoaded.amap) {
          await AMapLoader.load({
            key: apiKeys.amap, version: '2.0',
            plugins: ['AMap.PlaceSearch', 'AMap.Geocoder', 'AMap.Marker', 'AMap.TileLayer', 'AMap.GeoJSON'],
          });
          sdkLoaded.amap = true;
        }
        mapInstance.value = new AMap.Map('map-container', {
          resizeEnable: true, zoom: mapInitialConfigs.zoom, center: mapInitialConfigs.center,
          viewMode: is3DMode.value && currentMapProvider.value === 'amap' ? '3D' : '2D',
          pitch: is3DMode.value && currentMapProvider.value === 'amap' ? 60 : 0,
          rotation: is3DMode.value && currentMapProvider.value === 'amap' ? 30 : 0,
          buildingAnimation: is3DMode.value && currentMapProvider.value === 'amap',
          expandZoomRange: true, zooms: [3, 20],
        });
        console.log('高德地图初始化成功.');
      } catch (error) { console.error('高德地图加载或初始化失败:', error); sdkLoaded.amap = false; throw error; }
    };
    
    const initOpenLayersMapBase = async (isOSM = false) => {
        const layers = [];
        if (currentMapProvider.value === 'tianditu') {
            const key = apiKeys.tianditu;
            layers.push(new TileLayer({ source: new XYZ({ url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${key}`, crossOrigin: 'anonymous' }), zIndex: 0, className: 'tdt-vec-layer-debug' }));
            layers.push(new TileLayer({ source: new XYZ({ url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${key}`, crossOrigin: 'anonymous' }), zIndex: 1, className: 'tdt-cva-layer-debug' }));
        } else if (currentMapProvider.value === 'osm') {
             layers.push(new TileLayer({ source: new XYZ({ url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png', crossOrigin: 'anonymous' }), className: 'osm-base-layer-debug' }));
        }
        mapInstance.value = new OlMap({
            target: 'map-container', layers: layers,
            view: new View({ center: mapInitialConfigs.center, zoom: mapInitialConfigs.zoom, projection: 'EPSG:4326', constrainResolution: true }),
            controls: [], // 移除所有默认OL控件
        });
        console.log(`${currentMapProvider.value} (OpenLayers) 地图初始化成功.`);
    };

    const initTianDiTu = async () => { await initOpenLayersMapBase(false); };
    const initOSM = async () => { await initOpenLayersMapBase(true); };

    const initTencentMap = async () => {
      console.log('初始化腾讯地图 (TencentMap)...');
      return new Promise((resolve, reject) => {
        window.qqmap_callback = () => {
          try {
            if (typeof qq === 'undefined' || !qq.maps || !qq.maps.Map) { reject(new Error('腾讯地图SDK未就绪')); return; }
            sdkLoaded.tencent = true;
            const center = new qq.maps.LatLng(mapInitialConfigs.center[1], mapInitialConfigs.center[0]);
            mapInstance.value = new qq.maps.Map(document.getElementById('map-container'), {
              center: center, zoom: mapInitialConfigs.zoom,
              zoomControl: false, panControl: false, mapTypeControl: false, scaleControl: false, rotateControl: false,
            });
            console.log('腾讯地图初始化成功.'); resolve();
          } catch (error) { sdkLoaded.tencent = false; reject(error); }
        };
        if (!document.getElementById('tencent-sdk') || !sdkLoaded.tencent) {
          loadScript( `https://map.qq.com/api/js?v=2.exp&key=${apiKeys.tencent}&libraries=place&callback=qqmap_callback`, 'tencent-sdk', null );
        } else { if (window.qq && window.qq.maps) window.qqmap_callback(); else { reject(new Error("Tencent SDK script element exists but qq.maps not available."));} }
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

    // 修改后的 switchMapProvider 方法
    const switchMapProvider = async (newProvider) => {
      // 比较 newProvider 和当前的 currentMapProvider.value
      // 如果相同且地图已就绪，则不执行任何操作
      if (currentMapProvider.value === newProvider && isMapReady.value) {
        console.log(`地图源 ${newProvider} 已加载且就绪，无需切换。`);
        return;
      }
      console.log(`准备切换地图源从 ${currentMapProvider.value} 到: ${newProvider}`);
      currentMapProvider.value = newProvider; // 更新当前的地图源
      if (newProvider !== 'amap') {
        is3DMode.value = false; // 非高德地图，确保关闭3D模式
      }
      await initMap(); // 调用 initMap 重新初始化地图
    };

    watch(() => props.locationname, (newName) => {
      if (newName && isMapReady.value) {
        console.log(`监听到地点变化: ${newName}, 执行搜索`);
        searchLocation(newName);
      }
    });

    onMounted(async () => {
      await nextTick();
      // 初始加载时，直接调用 initMap，它会使用 currentMapProvider 的初始值
      await initMap();
    });

    onBeforeUnmount(() => {
      destroyCurrentMap();
      if (window.qqmap_callback) delete window.qqmap_callback;
    });

    return {
      currentMapProvider, // 需要暴露给模板 :value
      sidebarState,
      currentMapProviderLogo,
      currentMapProviderName,
      openSidebarHandler,
      closeSidebarHandler,
      handleGeoJsonLoaded,
      handleGeoJsonError,
      switchMapProvider, // 暴露给模板 @change
    };
  },
  // 移除了选项式 API 的 beforeUnmount，因为已在 setup 中使用 onBeforeUnmount
};
</script>

<style scoped>
/* 样式保持不变 */
#map-container {
  width: 100%;
  height: 100vh;
  background-color: #f0f0f0;
}
.map-controls-wrapper {
  z-index: 1000 !important;
}
:deep(.amap-logo), :deep(.amap-copyright), :deep(.amap-controls), :deep(.amap-zoomcontrol), :deep(.amap-scalecontrol) { display: none !important; visibility: hidden !important; }
:deep(.ol-attribution), :deep(.ol-zoom), :deep(.ol-rotate) { display: none !important; visibility: hidden !important; }
:deep(.tdt-control-copyright), :deep(.tdt-logo), :deep(img[src*="tianditu.gov.cn/images/logo.png"]), :deep(a[href*="tianditu.gov.cn"]) { display: none !important; visibility: hidden !important; }
:deep(.smnoprint), :deep(.logo_tencent), :deep(img[src*="map.qq.com/img/"]), :deep(a[href*="map.qq.com"]), :deep(.qq-maps-controls) { display: none !important; visibility: hidden !important; }
</style>