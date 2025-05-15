<template>
  <div class="map-wrapper relative w-full h-full">
    <div id="map-container" class="relative w-full h-full"></div>

    <div class="absolute top-6 right-6 flex flex-col space-y-2 map-controls-wrapper">
      <select
        v.model="currentMapProvider"
        @change="switchMapProvider($event.target.value)"
        class="bg-white text-gray-700 py-2 px-4 rounded-lg shadow-xl border border-gray-200 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ease-in-out cursor-pointer hover:shadow-2xl"
        title="切换地图源"
      >
        <option value="amap">高德地图</option>
        <option value="tianditu">天地图</option>
        <option value="tencent">腾讯地图</option>
        <option value="osm">OSM</option>
      </select>

      </div>
  </div>
</template>

<script>
import { ref, onMounted, watch, nextTick } from 'vue';
import AMapLoader from '@amap/amap-jsapi-loader'; // 仅高德需要
import { Map as OlMap, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
// 高德安全配置
window._AMapSecurityConfig = {
  securityJsCode: '23cadd0149127f0c18ae702236f72806', // 替换为你的高德安全密钥
};

export default {
  name: 'MultiMap',
  props: {
    locationname: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      mapInstance: null,
      currentMapProvider: 'amap',
      is3DMode: false, // 仅高德地图使用
      isMapReady: false,
      marker: null,
      apiKeys: {
        amap: '5d4d6dae7a5c65efb514bae12e669422', // 替换为你的高德Key
        tianditu: '0a7965f62c288964aed9de0d459f1145', // 替换为你的天地图Key
        tencent: 'BLMBZ-HWKKO-UB2W4-SYIZK-MQJV7-6NFCF', // 替换为你的腾讯地图Key
      },
      mapInitialConfigs: {
        center: [113, 28.2],
        zoom: 12,
      },
      sdkLoaded: {
        amap: false,
        tianditu: false,
        tencent: false,
      }
    };
  },
  watch: {
    locationname(newName) {
      if (newName && this.isMapReady) {
        console.log(`监听到地点变化: ${newName}, 当前地图源: ${this.currentMapProvider}`);
        this.searchLocation(newName);
      }
    },
  },
  methods: {
    loadScript(src, id, callback) {
      const existingScript = document.getElementById(id);
      if (existingScript) {
        console.log(`脚本 ${id} 已存在.`);
        if (id === 'tianditu-sdk' && window.T) {
            if (callback) callback();
        } else if (id === 'tencent-sdk' && window.qq && window.qq.maps) {
            if (callback) callback(); 
        } else if (id !== 'tianditu-sdk' && id !== 'tencent-sdk') {
            if (callback) callback();
        } else if (callback) {
            let retries = 0;
            const interval = setInterval(() => {
                retries++;
                if ((id === 'tianditu-sdk' && window.T) || (id === 'tencent-sdk' && window.qq && window.qq.maps)) {
                    clearInterval(interval);
                    if (callback) callback();
                } else if (retries > 20) { 
                    clearInterval(interval);
                    console.warn(`脚本 ${id} 已存在但SDK对象未就绪.`);
                    if (callback) callback(); 
                }
            }, 100);
        }
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.id = id;
      script.async = true; 
      script.onload = () => {
        console.log(`脚本 ${src} 加载成功`);
        if (callback) callback();
      };
      script.onerror = () => {
        console.error(`加载脚本 ${src} 失败`);
        const failedScript = document.getElementById(id);
        if (failedScript) failedScript.remove();
      };
      document.head.appendChild(script);
    },

    async destroyCurrentMap() {
      this.isMapReady = false; 
      console.log(`开始销毁地图: ${this.currentMapProvider || '无'}`);
      if (this.marker) {
        try {
            if (this.mapInstance && (this.currentMapProvider === 'amap' || this.currentMapProvider === 'osm')) {
                if (typeof this.mapInstance.remove === 'function') this.mapInstance.remove(this.marker);
            } else if (this.mapInstance && this.currentMapProvider === 'tianditu') {
                if (typeof this.mapInstance.removeOverLay === 'function') this.mapInstance.removeOverLay(this.marker); 
            } else if (this.currentMapProvider === 'tencent' && this.marker && typeof this.marker.setMap === 'function') {
                this.marker.setMap(null);
            }
        } catch (e) {
            console.warn('移除标记时出错:', e);
        }
        this.marker = null;
      }
      if (this.mapInstance) {
        if (this.currentMapProvider === 'amap' && typeof this.mapInstance.destroy === 'function') {
          this.mapInstance.destroy();
        }
        this.mapInstance = null;
      }
      const mapContainer = document.getElementById('map-container');
      if (mapContainer) mapContainer.innerHTML = ''; 
    },

    async initMap() {
      console.log(`准备初始化地图: ${this.currentMapProvider}`);
      await this.destroyCurrentMap(); 
      await nextTick(); 
      const mapContainer = document.getElementById('map-container');
      if (!mapContainer) {
        console.error("地图容器 'map-container' 未在DOM中找到!");
        return;
      }
      if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
          console.warn("地图容器 'map-container' 当前尺寸为0.");
      }
      mapContainer.innerHTML = ''; 
      console.log(`开始加载和初始化地图: ${this.currentMapProvider}`);
      try {
        switch (this.currentMapProvider) {
          case 'amap':
          case 'osm':
            await this.initAMap();
            break;
          case 'tianditu':
            await this.initTianDiTu();
            break;
          case 'tencent':
            await this.initTencentMap();
            break;
          default:
            console.error('未知的地图提供商:', this.currentMapProvider);
            return;
        }
        this.isMapReady = true;
        console.log(`${this.currentMapProvider} 地图初始化流程完成. isMapReady: ${this.isMapReady}`);
        if (this.locationname) {
          console.log(`地图就绪后，准备搜索初始地点: ${this.locationname}`);
          await nextTick(); 
          this.searchLocation(this.locationname);
        }
      } catch (error) {
          console.error(`初始化地图 ${this.currentMapProvider} 失败:`, error);
          this.isMapReady = false;
      }
    },

    async initAMap() {
      console.log('初始化高德地图 (AMap)...');
      try {
        if (!this.sdkLoaded.amap) {
            await AMapLoader.load({
            key: this.apiKeys.amap,
            version: '2.0',
            // 移除了 AMap.ControlBar，其他需要的插件保留
            plugins: ['AMap.PlaceSearch', 'AMap.Geocoder', 'AMap.Marker', 'AMap.TileLayer'], 
          });
          this.sdkLoaded.amap = true;
        }
        const mapContainerEl = document.getElementById('map-container');
        if (!mapContainerEl || mapContainerEl.clientHeight === 0) throw new Error('地图容器无效或高度为0');

        this.mapInstance = new AMap.Map('map-container', {
          resizeEnable: true,
          zoom: this.mapInitialConfigs.zoom,
          center: this.mapInitialConfigs.center,
          viewMode: this.is3DMode && this.currentMapProvider === 'amap' ? '3D' : '2D',
          pitch: this.is3DMode && this.currentMapProvider === 'amap' ? 60 : 0,
          rotation: this.is3DMode && this.currentMapProvider === 'amap' ? 30 : 0,
          buildingAnimation: this.currentMapProvider === 'amap',
          expandZoomRange: true,
          zooms: [3, 20],
          // 以下选项确保不显示默认控件
          // AMap 2.0 中，控件通常是手动添加的，这里确保没有多余的默认控件设置
          // zoomEnable: true, // 允许缩放交互
          // dragEnable: true, // 允许拖拽交互
          // keyboardEnable: true, // 允许键盘交互
          // doubleClickZoom: true, // 允许双击放大
          // scrollWheel: true, // 允许滚轮缩放
          // touchZoom: true, // 允许触摸缩放
          // showBuildingBlock: false, // 3D模式下是否显示楼块，根据需求
        });
        if (this.currentMapProvider === 'osm') {
          const osmLayer = new AMap.TileLayer({
            getTileUrl: (x, y, z) => `https://${['a', 'b', 'c'][Math.floor(Math.random() * 3)]}.tile.openstreetmap.org/${z}/${x}/${y}.png`,
            zIndex: 10, 
            tileSize: 256,
          });
          this.mapInstance.add(osmLayer);
        }
        // 不再添加 AMap.ControlBar
        console.log('高德地图初始化成功 (无默认控件).');
      } catch (error) {
        console.error('高德地图加载或初始化失败:', error);
        this.sdkLoaded.amap = false; 
        throw error; 
      }
    },

    async initTianDiTu() {
      console.log('初始化天地图 (TianDiTu)...');
      const key = this.apiKeys.tianditu;
      const urlTpl = `https://t0.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${key}`;
      // 天地图默认控件较少，主要通过CSS隐藏Logo/版权
      // 如果有其他默认控件出现，可能需要特定API移除或更具体的CSS选择器
      // 创建 OL 地图实例
      this.mapInstance = new OlMap({
        target: 'map-container',
        view: new View({
          center: [113, 28.2],
          zoom: 12,
          projection: 'EPSG:4326'
        })
      });
  
      // 底图矢量图层
      const vecLayer = new TileLayer({
        source: new XYZ({
          url: `https://t0.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${key}`,
          crossOrigin: 'anonymous',
          tileLoadFunction: (tile, src) => {
            const img = tile.getImage();
            img.crossOrigin = 'anonymous';
            img.src = src;
            img.onerror = () => { img.src = '/images/blank.png'; };
          }
        }),
        zIndex: 0
      });

      // 注记文字图层
      const labelLayer = new TileLayer({
        source: new XYZ({
          url: `https://t0.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${key}`,
          crossOrigin: 'anonymous',
          tileLoadFunction: (tile, src) => {
            const img = tile.getImage();
            img.crossOrigin = 'anonymous';
            img.src = src;
            img.onerror = () => { img.src = '/images/blank.png'; };
          }
        }),
        zIndex: 1
      });

      // 将两层都添加到地图
      this.mapInstance.addLayer(vecLayer);   // 底图
      this.mapInstance.addLayer(labelLayer); // 注记文字层 :contentReference[oaicite:1]{index=1}
    
      this.isMapReady = true;
    },

    async initTencentMap() {
      console.log('初始化腾讯地图 (TencentMap)...');
      return new Promise((resolve, reject) => {
        window.qqmap_callback = () => {
          try {
            if (typeof qq === 'undefined' || !qq.maps || !qq.maps.Map) {
              reject(new Error('腾讯地图 qq 对象或 qq.maps.Map 未定义'));
              return;
            }
            this.sdkLoaded.tencent = true;
            const mapContainerEl = document.getElementById('map-container');
            if (!mapContainerEl || mapContainerEl.clientHeight === 0) reject(new Error('地图容器无效或高度为0'));

            const center = new qq.maps.LatLng(this.mapInitialConfigs.center[1], this.mapInitialConfigs.center[0]); 
            this.mapInstance = new qq.maps.Map(document.getElementById('map-container'), {
              center: center,
              zoom: this.mapInitialConfigs.zoom,
              // 禁用所有腾讯地图的默认UI控件
              zoomControl: false,       // 缩放控件
              panControl: false,        // 平移控件
              mapTypeControl: false,    // 地图类型切换控件 (如卫星/街道)
              scaleControl: false,      // 比例尺控件
              rotateControl: false,     // 旋转控件 (通常用于3D或特定视角)
              // navigationControl: false, // 旧版可能有此，新版主要通过 zoomControl, panControl
              // streetViewControl: false, // 街景控件
            });
            console.log('腾讯地图初始化成功 (已禁用默认控件).');
            resolve();
          } catch (error) {
            this.sdkLoaded.tencent = false; 
            reject(error);
          }
        };
        if (!document.getElementById('tencent-sdk') || !this.sdkLoaded.tencent) {
            this.loadScript(
              `https://map.qq.com/api/js?v=2.exp&key=${this.apiKeys.tencent}&callback=qqmap_callback`,
              'tencent-sdk',
              null 
            );
        } else {
            if (window.qq && window.qq.maps && typeof window.qqmap_callback === 'function') {
                 window.qqmap_callback();
            }
        }
      });
    },

    toggleViewMode() { // 此方法现在未被使用，因为按钮被注释掉了
      if (this.currentMapProvider === 'amap' && this.mapInstance) {
        this.is3DMode = !this.is3DMode;
        this.initMap(); 
      } else {
        alert('3D模式切换当前仅支持高德地图。');
      }
    },

    async searchLocation(locationName) {
      if (!this.isMapReady || !this.mapInstance) return;
      if (this.marker) {
        try {
            if ((this.currentMapProvider === 'amap' || this.currentMapProvider === 'osm') && this.mapInstance.remove) this.mapInstance.remove(this.marker);
            else if (this.currentMapProvider === 'tianditu' && this.mapInstance.removeOverLay) this.mapInstance.removeOverLay(this.marker);
            else if (this.currentMapProvider === 'tencent' && this.marker.setMap) this.marker.setMap(null);
        } catch(e) { console.warn("移除旧标记出错:", e); }
        this.marker = null;
      }

      if (this.currentMapProvider === 'amap' || this.currentMapProvider === 'osm') {
        if (!window.AMap || !AMap.PlaceSearch) return;
        const placeSearch = new AMap.PlaceSearch({ map: this.mapInstance, pageSize: 1, pageIndex: 1, autoFitView: true });
        placeSearch.search(locationName, (status, result) => {
          if (status === 'complete' && result.poiList && result.poiList.pois.length > 0) {
            const poi = result.poiList.pois[0];
            this.marker = new AMap.Marker({ position: poi.location, map: this.mapInstance, title: poi.name });
          } else console.error('高德/OSM搜索失败:', result);
        });
      } else if (this.currentMapProvider === 'tianditu') {
        if (!window.T || !T.LocalSearch) return;
        const localSearch = new T.LocalSearch(this.mapInstance, {
          pageCapacity: 1,
          onSearchComplete: (results) => {
            if (results && results.getPois && results.getPois().length > 0) {
              const poi = results.getPois()[0];
              this.mapInstance.panTo(poi.getLngLat(), this.mapInitialConfigs.zoom + 2); 
              this.marker = new T.Marker(poi.getLngLat());
              this.mapInstance.addOverLay(this.marker); 
            } else console.error('天地图搜索失败:', results);
          }
        });
        localSearch.search(locationName);
      } else if (this.currentMapProvider === 'tencent') {
         if (!window.qq || !qq.maps || !qq.maps.SearchService) return;
        const searchService = new qq.maps.SearchService({
          map: this.mapInstance,
          pageCapacity: 1,
          autoExtend: true, 
          complete: (results) => {
            if (results && results.detail && results.detail.pois && results.detail.pois.length > 0) {
              const poi = results.detail.pois[0];
              this.mapInstance.setCenter(poi.latLng);
              this.mapInstance.setZoom(this.mapInitialConfigs.zoom + 2);
              this.marker = new qq.maps.Marker({ position: poi.latLng, map: this.mapInstance, title: poi.name });
            } else console.error('腾讯地图搜索失败:', results);
          },
          error: (err) => console.error('腾讯地图搜索服务出错:', err)
        });
        searchService.search(locationName);
      }
    },

    async switchMapProvider(provider) {
      if (this.currentMapProvider === provider && this.isMapReady) return;
      this.currentMapProvider = provider;
      if (provider !== 'amap') this.is3DMode = false; 
      await this.initMap(); 
    },
  },
  async mounted() {
    await nextTick();
    await this.switchMapProvider(this.currentMapProvider); 
    if (this.locationname && this.isMapReady) {
        this.searchLocation(this.locationname);
    }
  },
  beforeUnmount() {
    this.destroyCurrentMap(); 
    if (window.qqmap_callback) delete window.qqmap_callback;
  },
};
</script>

<style scoped>
/* 通用样式 */
#map-container {
  width: 100%;
  height: 100vh; /* 或者父容器指定的高度 */
  background-color: #f0f0f0; /* 初始背景色，防止空白 */
}

/* 功能按钮组的包裹容器样式 */
.map-controls-wrapper {
  z-index: 1000 !important; /* 确保控件在地图上层 */
  /* 你可以在这里添加更多样式来美化选择器的容器，如果需要的话 */
}

/* --- 隐藏地图Logo和版权信息 --- */
/* 务必谨慎使用，并了解相关服务条款的风险 */

/* 高德地图 Logo 和 版权, 以及默认控件的容器(如果存在且需要隐藏) */
:deep(.amap-logo),
:deep(.amap-copyright),
:deep(.amap-controls) { /* 尝试隐藏高德控件容器 */
  display: none !important;
  visibility: hidden !important;
}

/* 天地图 Logo 和 版权, 以及可能的控件容器 */
:deep(.tdt-control-copyright),
:deep(.tdt-logo), 
:deep(img[src*="tianditu.gov.cn/images/logo.png"]), 
:deep(a[href*="tianditu.gov.cn"]),
:deep(.tdt-control-container), /* 尝试隐藏天地图控件容器 */
:deep(.tdt-control-zoom), /* 隐藏天地图缩放控件 */
:deep(.tdt-control-scale) /* 隐藏天地图比例尺 */
 {
  display: none !important;
  visibility: hidden !important;
}

/* 腾讯地图 Logo 和 版权, 以及可能的控件容器 */
/* 腾讯地图通过API参数禁用了控件，这里主要是Logo和版权 */
:deep(.smnoprint), 
:deep(.logo_tencent),
:deep(img[src*="map.qq.com/img/"]), 
:deep(a[href*="map.qq.com"]),
:deep(.qq-maps-controls) /* 假设的腾讯控件容器类名，如果API禁用不彻底 */
 {
  display: none !important;
  visibility: hidden !important;
}

/* 针对特定地图可能残留的、未被API完全移除的控件UI元素 */
/* 你可能需要根据实际情况，通过浏览器开发者工具检查并添加更精确的选择器 */
:deep(.amap-zoomcontrol), /* 高德缩放控件的具体类名（如果ControlBar移除不彻底） */
:deep(.amap-scalecontrol) /* 高德比例尺控件的具体类名 */
{
    display: none !important;
    visibility: hidden !important;
}

</style>
