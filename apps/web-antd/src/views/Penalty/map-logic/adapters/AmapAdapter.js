// src/map-logic/adapters/AmapAdapter.js

import { loadAmapSdk } from '../sdkLoader';
import { v4 as uuidv4 } from 'uuid';
import { gcj02towgs84 } from '../coordTransform.js';

export class AmapAdapter {
  constructor(containerId, options) {
    this.containerId = containerId;
    this.key = options.key;
    this.securityCode = options.securityCode;
    this.map = null;
    this.layers = new Map(); // 使用Map来存储图层, key: layerId, value: { amapLayer, originalData, ... }
    this.mouseTool = null;
    this.infoWindow = null;
    this.isInfoQueryActive = false;
    this._infoQueryClickHandler = this._handleInfoQueryClick.bind(this);
    this.drawTool = null; // **新增：绘制工具实例**
    this._onDrawHandler = null;
  }

  async init(initialView) {
    await loadAmapSdk(this.key, this.securityCode);
    this.map = new AMap.Map(this.containerId, {
      resizeEnable: true,
      center: initialView.center,
      zoom: initialView.zoom,
      viewMode: '2D',
    });
    console.log('[AmapAdapter] Map object created. Resolving init promise.');
    return this;
  }

   destroy() {
    if (this.mouseTool) {
      this.mouseTool.close(true);
      this.mouseTool = null;
    }
    if (this.map) {
      this.map.destroy();
      this.map = null;
    }
    // **增加安全检查**
    if (this.layers && typeof this.layers.clear === 'function') {
      this.layers.clear();
    }
    if (this.drawTool) this.drawTool.close(true); // **新增：销毁绘制工具**
    // 确保所有引用被清理
    this.layers = null;
    this.infoWindow = null;
    
  }

  getMapView() {
    if (!this.map) return null;
    const center = this.map.getCenter();
    return {
      center: [center.lng, center.lat],
      zoom: this.map.getZoom(),
    };
  }

  addGeoJsonLayer(geojson, options) {
    const layerId = options.id || uuidv4();
    const amapGeoJSON = new AMap.GeoJSON({
      geoJSON: geojson,
      getPolygon: (geojsonObject, lnglats) => {
        const polygon = new AMap.Polygon({
          path: lnglats,
          fillColor: '#ED6A45',
          fillOpacity: 0.6,
          strokeColor: '#fff',
          strokeWeight: 2,
          extData: { layerId, feature: geojsonObject }
        });
        if (this.isInfoQueryActive) {
            polygon.on('click', this._infoQueryClickHandler);
        }
        return polygon;
      },
      // ...可以添加 getMarker, getPolyline
    });

    this.map.add(amapGeoJSON);
    this.layers.set(layerId, {
      mapLayer: amapGeoJSON,
      originalData: geojson,
      name: options.name,
      isVisible: true,
    });
    this.map.setFitView([amapGeoJSON], false, [60, 60, 60, 60], 17);
    return layerId;
  }

  removeLayer(layerId) {
    if (this.layers.has(layerId)) {
      const { mapLayer } = this.layers.get(layerId);
      this.map.remove(mapLayer);
      this.layers.delete(layerId);
    }
  }

  toggleLayerVisibility(layerId, isVisible) {
    if (this.layers.has(layerId)) {
      const layerInfo = this.layers.get(layerId);
      isVisible ? layerInfo.mapLayer.show() : layerInfo.mapLayer.hide();
      layerInfo.isVisible = isVisible;
    }
  }

  enableBoxSelect(onSelectCallback) {
    this.disableBoxSelect(); // Ensure any previous instance is closed
    this.mouseTool = new AMap.MouseTool(this.map);
    this.mouseTool.rectangle({
      strokeColor: "#007bff",
      fillColor: "#007bff",
      fillOpacity: 0.1
    });

    this.mouseTool.on('draw', event => {
      const bounds = event.obj.getBounds();
      const selectedFeatures = [];
      this.layers.forEach(layerInfo => {
        if (!layerInfo.isVisible) return;
        layerInfo.mapLayer.eachOverlay(overlay => {
            if (overlay.getBounds && bounds.intersects(overlay.getBounds())) {
                selectedFeatures.push({
                    layerId: layerInfo.id,
                    layerName: layerInfo.name,
                    properties: overlay.getExtData().feature.properties || {}
                });
            }
        });
      });
      onSelectCallback(selectedFeatures);
      this.map.remove(event.obj); // Remove the drawn rectangle
      this.disableBoxSelect();
    });
  }

  disableBoxSelect() {
    if (this.mouseTool) {
      this.mouseTool.close(true); // true to remove the drawing overlay
      this.mouseTool = null;
    }
  }

  enableInfoQuery() {
    this.isInfoQueryActive = true;
    this.map.getContainer().style.cursor = 'pointer';
    this.layers.forEach(layerInfo => {
        layerInfo.mapLayer.eachOverlay(overlay => {
            if (overlay instanceof AMap.Polygon) {
                overlay.on('click', this._infoQueryClickHandler);
            }
        });
    });
  }

  disableInfoQuery() {
    this.isInfoQueryActive = false;
    this.map.getContainer().style.cursor = 'grab';
    if(this.infoWindow) this.infoWindow.close();
    this.layers.forEach(layerInfo => {
        layerInfo.mapLayer.eachOverlay(overlay => {
            if (overlay instanceof AMap.Polygon) {
                overlay.off('click', this._infoQueryClickHandler);
            }
        });
    });
  }

  _handleInfoQueryClick(e) {
    if (this.infoWindow) this.infoWindow.close();
    
    const polygon = e.target;
    const extData = polygon.getExtData();
    const properties = extData.feature.properties || {};
    const area = AMap.GeometryUtil.ringArea(polygon.getPath());
    
    const content = `
      <div class="custom-info-window" style="background:white; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.2); width:auto; min-width:200px; padding:10px;">
        <div style="font-weight:bold; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px;">${properties.name || '区域信息'}</div>
        <div><p>面积: ${area.toFixed(2)} m²</p><p style="color:#d9534f; font-weight:bold;">疑似推土区域</p></div>
      </div>
    `;

    this.infoWindow = new AMap.InfoWindow({
        isCustom: true,
        content: content,
        offset: new AMap.Pixel(0, -30),
    });
    this.infoWindow.open(this.map, e.lnglat);
  }

   // **新增：实现绘制功能**
  enablePolygonDraw(onDrawEndCallback) {
  // 先保证一个干净的起点
  this.disablePolygonDraw();

  const startPolygonDraw = () => {
    // 每次都创建新的 MouseTool 实例（关键）
    this.drawTool = new AMap.MouseTool(this.map);

    // 定义一次性的回调引用，方便后面移除/置空
    this._onDrawHandler = (event) => {
      const polygon = event.obj;

      // 将 GCJ-02 点转换为 WGS-84，确保返回 [lng, lat] 数组
      const pathWGS84 = polygon.getPath().map(pt => {
        const [lng, lat] = gcj02towgs84(pt.getLng(), pt.getLat());
        return [lng, lat];
      });

      const geojsonFeature = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [pathWGS84] },
        properties: { area: AMap.GeometryUtil.ringArea(polygon.getPath()) }
      };
      const featureCollection = { type: 'FeatureCollection', features: [geojsonFeature] };

      // 调用外部回调（保护性 try/catch）
      try { onDrawEndCallback(featureCollection); } catch (e) { console.error(e); }

      // 从地图上移除临时绘制对象（可选，close(true) 也会清理）
      try { this.map.remove(polygon); } catch (e) { /* ignore */ }

      // ---- 关键清理步骤：彻底关闭并销毁当前 drawTool ----
      try {
        // true: remove any overlays and should reset internal state
        this.drawTool.close(true);
      } catch (e) { /* ignore */ }

      // 释放引用，避免残留事件
      this.drawTool = null;
      this._onDrawHandler = null;

      // 用 setTimeout 推到下一“事件循环”，确保 AMap 内部状态完全清理后再新建
      setTimeout(() => {
        // 重新启动一个全新的绘制工具，保持连续绘制体验
        startPolygonDraw();
      }, 0);
    };

    // 绑定监听并开始绘制
    this.drawTool.on('draw', this._onDrawHandler);
    this.drawTool.polygon({
      strokeColor: "#007bff",
      fillColor: "#ED6A45",
      fillOpacity: 0.6
    });
  };

  // 启动第一次绘制
  startPolygonDraw();
}

disablePolygonDraw() {
  // 关闭并清理 MouseTool（完全销毁）
  if (this.drawTool) {
    try { this.drawTool.close(true); } catch (e) {}
    this.drawTool = null;
  }
  this._onDrawHandler = null;
}
}


