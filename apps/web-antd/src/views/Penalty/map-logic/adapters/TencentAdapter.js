// src/map-logic/adapters/TencentAdapter.js

import { loadTencentSdk } from '../sdkLoader';
import { v4 as uuidv4 } from 'uuid';

export class TencentAdapter {
  constructor(containerId, options) {
    this.containerId = containerId;
    this.key = options.key;
    this.map = null;
    this.layers = new Map();
    this.infoWindow = null;
    this._infoQueryClickHandler = this._handleInfoQueryClick.bind(this);
    this.drawingManager = null; // **新增：绘制管理器**
  }

  async init(initialView) {
    await loadTencentSdk(this.key);
    this.map = new qq.maps.Map(document.getElementById(this.containerId), {
      center: new qq.maps.LatLng(initialView.center[1], initialView.center[0]),
      zoom: initialView.zoom,
      mapTypeControl: false,
      panControl: false,
      zoomControl: false
    });
    return this;
  }

  destroy() {
    const container = document.getElementById(this.containerId);
    if (container) container.innerHTML = '';
    
    // **增加安全检查**
    if (this.layers && typeof this.layers.clear === 'function') {
      this.layers.forEach(layerInfo => {
        layerInfo.mapOverlays.forEach(overlay => overlay.setMap(null));
      });
      this.layers.clear();
    }
    this.drawingManager = null;
    // 确保所有引用被清理
    this.layers = null;
    this.map = null;
    this.infoWindow = null;
  }

  getMapView() {
    if (!this.map) return null;
    const center = this.map.getCenter();
    return {
      center: [center.getLng(), center.getLat()],
      zoom: this.map.getZoom(),
    };
  }
  
  // 腾讯地图需要手动解析GeoJSON
  addGeoJsonLayer(geojson, options) {
    const layerId = options.id || uuidv4();
    const mapOverlays = [];
    
    geojson.features.forEach(feature => {
      const geomType = feature.geometry.type;
      const coords = feature.geometry.coordinates;
      
      if (geomType === 'Polygon') {
        const polygonPath = coords[0].map(c => new qq.maps.LatLng(c[1], c[0]));
        const polygon = new qq.maps.Polygon({
          path: polygonPath,
          map: this.map,
          fillColor: new qq.maps.Color(237, 106, 69, 0.6),
          strokeColor: new qq.maps.Color(255, 255, 255, 1),
          strokeWeight: 2,
        });
        qq.maps.event.addListener(polygon, 'click', (e) => this._infoQueryClickHandler(e, feature.properties));
        mapOverlays.push(polygon);
      }
      // 可以补充 Point 和 LineString 的逻辑
    });

    this.layers.set(layerId, { mapOverlays, name: options.name, isVisible: true });
    
    // Zoom to fit
    const bounds = new qq.maps.LatLngBounds();
    mapOverlays.forEach(overlay => {
      if (overlay instanceof qq.maps.Polygon) {
        overlay.getPath().forEach(latLng => bounds.extend(latLng));
      }
    });
    if (!bounds.isEmpty()) {
        this.map.fitBounds(bounds);
    }
    
    return layerId;
  }

  removeLayer(layerId) {
    if (this.layers.has(layerId)) {
      this.layers.get(layerId).mapOverlays.forEach(overlay => overlay.setMap(null));
      this.layers.delete(layerId);
    }
  }

  toggleLayerVisibility(layerId, isVisible) {
    if (this.layers.has(layerId)) {
      this.layers.get(layerId).mapOverlays.forEach(overlay => overlay.setVisible(isVisible));
    }
  }

  // BoxSelect 和 InfoQuery 的实现对于腾讯地图较为复杂，此处作简化示意
  enableBoxSelect(onSelectCallback) {
    console.warn('TencentMap BoxSelect not fully implemented.');
    // 实际实现需要使用 qq.maps.drawing.DrawingManager
    onSelectCallback([]); // 返回空结果
  }

  disableBoxSelect() {}

  enableInfoQuery() {
    // InfoQuery 的 click 事件已在 addGeoJsonLayer 中绑定
    console.log("TencentMap InfoQuery is enabled via polygon clicks.");
  }
  
  disableInfoQuery() {
    if(this.infoWindow) this.infoWindow.close();
  }
  
  _handleInfoQueryClick(event, properties) {
      if (this.infoWindow) this.infoWindow.close();
      
      const content = `
        <div style="padding:10px; font-size:14px;">
            <b>${properties.name || '区域信息'}</b>
        </div>
      `;
      
      this.infoWindow = new qq.maps.InfoWindow({
          map: this.map,
          content: content,
          position: event.latLng,
      });
  }


  enablePolygonDraw(onDrawEndCallback) {
    this.disablePolygonDraw();

    this.drawingManager = new qq.maps.drawing.DrawingManager({
        drawingMode: qq.maps.drawing.OverlayType.POLYGON,
        drawingControl: false, // 我们用自己的按钮控制
        polygonOptions: {
            strokeColor: new qq.maps.Color(0, 123, 255, 1),
            fillColor: new qq.maps.Color(0, 123, 255, 0.3),
        }
    });
    this.drawingManager.setMap(this.map);

    qq.maps.event.addListener(this.drawingManager, 'polygoncomplete', event => {
      // event 是绘制出的 qq.maps.Polygon 对象
      const polygon = event;
      
      // 将 qq.maps.Polygon 转换为 GeoJSON
      const path = polygon.getPath().getArray().map(latlng => [latlng.getLng(), latlng.getLat()]);
      // 腾讯绘制的多边形需要闭合，GeoJSON也需要，所以检查一下
      if (path.length > 0 && (path[0][0] !== path[path.length - 1][0] || path[0][1] !== path[path.length - 1][1])) {
        path.push(path[0]);
      }
      
      const geojsonFeature = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [path] },
        properties: {},
      };

      const featureCollection = { type: 'FeatureCollection', features: [geojsonFeature] };

      onDrawEndCallback(featureCollection);

      this.disablePolygonDraw();
      // **重要**：移除绘制的图形
      polygon.setMap(null);
    });
  }

  disablePolygonDraw() {
    if (this.drawingManager) {
      this.drawingManager.setMap(null);
      this.drawingManager = null;
    }
  }
}