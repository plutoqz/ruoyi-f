// src/map-logic/adapters/OpenLayersAdapter.js

import { Map, View, Overlay } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Circle as CircleStyle } from 'ol/style';
import XYZ from 'ol/source/XYZ';
import { Draw } from 'ol/interaction';
import { createBox } from 'ol/interaction/Draw';
import { transform, fromLonLat, toLonLat } from 'ol/proj';
import { v4 as uuidv4 } from 'uuid';

export class OpenLayersAdapter {
  constructor(containerId, options) {
    this.containerId = containerId;
    this.provider = options.provider; // 'tianditu' or 'osm'
    this.key = options.key; // Tianditu key
    this.map = null;
    this.layers = new Map();
    this.drawInteraction = null;
    this.drawLayer = null;
    this.infoOverlay = null;
    this.infoOverlayElement = null;
    this._infoQueryClickHandler = this._handleInfoQueryClick.bind(this);
    this.polygonDrawInteraction = null; // **新增：专门用于绘制多边形的交互**
    this.polygonDrawLayer = null; // <-- 新增一个属性来管理临时图层
    this.polygonDrawCallback = null; // 新增：存储绘制回调函数
  }

  async init(initialView) {
    const center = fromLonLat(initialView.center); // OL uses EPSG:3857, transform from WGS84
    
    const tileLayers = [];
    if (this.provider === 'tianditu') {
      // 天地图矢量底图
      tileLayers.push(new TileLayer({
        source: new XYZ({
          url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${this.key}`,
          crossOrigin: 'anonymous',
        }),
      }));
      // 天地图注记
      tileLayers.push(new TileLayer({
        source: new XYZ({
          url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${this.key}`,
          crossOrigin: 'anonymous',
        }),
        zIndex: 1,
      }));
    } else { // 'osm'
      tileLayers.push(new TileLayer({
        source: new XYZ({
          url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          crossOrigin: 'anonymous',
        }),
      }));
    }

    this.map = new Map({
      target: this.containerId,
      layers: tileLayers,
      view: new View({
        center: center,
        zoom: initialView.zoom,
        constrainResolution: true,
      }),
      controls: [], // Hide default controls
    });
    
    // 创建用于信息弹窗的Overlay
    this._createInfoOverlay();

    return this; // No async needed after map creation
  }

  destroy() {
    if (this.map) {
      // this.layers.forEach(layer => {
      //   try {
      //     this.map.removeLayer(layer);
      //   } catch (e) { /* ignore */ }
      // });
      this.map.setTarget(null);
      this.map = null;
    }
    // **增加安全检查**
    if (this.layers && typeof this.layers.clear === 'function') {
      this.layers.clear();
    }
    if (this.polygonDrawInteraction) this.map.removeInteraction(this.polygonDrawInteraction);
    // 确保所有引用被清理
    this.layers = null;
    this.drawInteraction = null;
    this.drawLayer = null;
    this.infoOverlay = null;
  }

  getMapView() {
    if (!this.map) return null;
    const view = this.map.getView();
    const center3857 = view.getCenter();
    return {
      center: toLonLat(center3857), // Transform back to WGS84 for consistency
      zoom: view.getZoom(),
    };
  }
  
  // 假设传入的geojson是 WGS84 (EPSG:4326)
  addGeoJsonLayer(geojson, options) {
    const layerId = options.id || uuidv4();
    const vectorSource = new VectorSource({
      features: new GeoJSON({ featureProjection: 'EPSG:3857' }).readFeatures(geojson),
    });

    const styleFunction = (feature) => {
      const geomType = feature.getGeometry().getType();
      if (geomType.includes('Polygon')) {
        return new Style({
          fill: new Fill({ color: 'rgba(237, 106, 69, 0.6)' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        });
      }
      // Add other styles for points and lines if needed
      return new Style({ /* default style */ });
    };

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: styleFunction,
    });
    
    vectorLayer.set('id', layerId);
    vectorLayer.set('name', options.name);

    this.map.addLayer(vectorLayer);
    this.layers.set(layerId, vectorLayer);
    
    if (vectorSource.getFeatures().length > 0) {
      this.map.getView().fit(vectorSource.getExtent(), { padding: [60, 60, 60, 60], duration: 1000, maxZoom: 17 });
    }

    return layerId;
  }

  removeLayer(layerId) {
    console.log(`[OpenLayersAdapter] Attempting to remove layer with ID: ${layerId}`);
    
    // 直接从 Map 中获取 VectorLayer 实例
    const layerToRemove = this.layers.get(layerId);

    if (layerToRemove) {
      console.log('[OpenLayersAdapter] Layer found, removing from map:', layerToRemove);
      try {
        this.map.removeLayer(layerToRemove); // 使用获取到的对象引用
        this.layers.delete(layerId); // 如果成功，从我们的映射中删除
        console.log(`[OpenLayersAdapter] Layer ${layerId} removed successfully.`);
      } catch (e) {
        console.error(`[OpenLayersAdapter] Error removing layer ${layerId}:`, e);
      }
    } else {
      console.warn(`[OpenLayersAdapter] Layer with ID ${layerId} not found in the layer map.`);
    }
  }

  toggleLayerVisibility(layerId, isVisible) {
    console.log(`[OpenLayersAdapter] Toggling visibility for layer ${layerId} to ${isVisible}`);
    
    const layerToToggle = this.layers.get(layerId);
    
    if (layerToToggle) {
      console.log('[OpenLayersAdapter] Layer found, setting visibility:', layerToToggle);
      layerToToggle.setVisible(isVisible);
    } else {
      console.warn(`[OpenLayersAdapter] Layer with ID ${layerId} not found for toggling visibility.`);
    }
  }

  enableBoxSelect(onSelectCallback) {
    this.disableBoxSelect();
    this.drawLayer = new VectorLayer({ source: new VectorSource(), style: new Style({ fill: new Fill({ color: 'rgba(0,123,255,0.1)' }), stroke: new Stroke({ color: '#007bff', width: 2 }) }), zIndex: 1000 });
    this.map.addLayer(this.drawLayer);
    
    this.drawInteraction = new Draw({
      source: this.drawLayer.getSource(),
      type: 'Circle',
      geometryFunction: createBox(),
    });
    this.map.addInteraction(this.drawInteraction);

    this.drawInteraction.on('drawend', event => {
      const extent = event.feature.getGeometry().getExtent();
      const selectedFeatures = [];
      this.layers.forEach((layerInfo, layerId) => {
        if (layerInfo.isVisible) {
          layerInfo.mapLayer.getSource().forEachFeatureInExtent(extent, (feature) => {
            const props = {...feature.getProperties()};
            delete props.geometry; // Clean up properties
            selectedFeatures.push({
              layerId: layerId,
              layerName: layerInfo.name,
              properties: props,
            });
          });
        }
      });
      onSelectCallback(selectedFeatures);
      this.disableBoxSelect();
    });
  }

  disableBoxSelect() {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.drawInteraction = null;
    }
    if (this.drawLayer) {
      this.map.removeLayer(this.drawLayer);
      this.drawLayer = null;
    }
  }

  enableInfoQuery() {
    this.map.on('click', this._infoQueryClickHandler);
    this.map.getTargetElement().style.cursor = 'pointer';
  }

  disableInfoQuery() {
    this.map.un('click', this._infoQueryClickHandler);
    this.map.getTargetElement().style.cursor = 'grab';
    if (this.infoOverlay) this.infoOverlay.setPosition(undefined);
  }

  _createInfoOverlay() {
      this.infoOverlayElement = document.createElement('div');
      this.infoOverlayElement.className = 'custom-info-window'; // Add your styles
      this.infoOverlay = new Overlay({
        element: this.infoOverlayElement,
        autoPan: { animation: { duration: 250 } },
      });
      this.map.addOverlay(this.infoOverlay);
  }

  _handleInfoQueryClick(event) {
    this.infoOverlay.setPosition(undefined);
    const feature = this.map.forEachFeatureAtPixel(event.pixel, (f) => f);
    if (feature) {
      const props = feature.getProperties();
      const area = feature.getGeometry().getArea(); // Returns area in projection units (m²)
      const content = `
        <div style="background:white; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.2); width:auto; min-width:200px; padding:10px;">
          <div style="font-weight:bold; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px;">${props.name || '区域信息'}</div>
          <div><p>面积: ${(area / 1000000).toFixed(4)} km²</p></div>
        </div>
      `;
      this.infoOverlayElement.innerHTML = content;
      this.infoOverlay.setPosition(event.coordinate);
    }
  }


  enablePolygonDraw(onDrawEndCallback) {
    // 存储回调函数以便后续使用
    this.polygonDrawCallback = onDrawEndCallback;
    
    // 如果已经启用了绘制，则只需重置状态
    if (this.polygonDrawInteraction) {
      this._resetPolygonDraw();
      return;
    }

    // 第一次启用时创建资源
    this.polygonDrawSource = new VectorSource();
    this.polygonDrawLayer = new VectorLayer({ 
      source: this.polygonDrawSource,
      style: new Style({
        stroke: new Stroke({
          color: 'rgba(0,153,255,0.7)',
          width: 3
        }),
        fill: new Fill({
          color: 'rgba(0,153,255,0.2)'
        })
      })
    });
    this.map.addLayer(this.polygonDrawLayer);

    // 创建绘制交互
    this.polygonDrawInteraction = new Draw({
      source: this.polygonDrawSource,
      type: 'Polygon',
    });
    this.map.addInteraction(this.polygonDrawInteraction);

    // 处理绘制结束事件
    this.polygonDrawInteraction.on('drawend', this._handlePolygonDrawEnd.bind(this));
  }

  disablePolygonDraw() {
    if (this.polygonDrawInteraction) {
      this.map.removeInteraction(this.polygonDrawInteraction);
      this.polygonDrawInteraction = null;
    }
    
    if (this.polygonDrawLayer) {
      this.map.removeLayer(this.polygonDrawLayer);
      this.polygonDrawLayer = null;
    }
    
    if (this.polygonDrawSource) {
      this.polygonDrawSource.clear();
      this.polygonDrawSource = null;
    }
    
    this.polygonDrawCallback = null;
  }

  // 新增：重置绘制状态
  _resetPolygonDraw() {
    // 清除之前的绘制
    this.polygonDrawSource.clear();
    
    // 移除旧的绘制交互
    this.map.removeInteraction(this.polygonDrawInteraction);
    
    // 创建新的绘制交互
    this.polygonDrawInteraction = new Draw({
      source: this.polygonDrawSource,
      type: 'Polygon',
    });
    
    // 重新添加交互
    this.map.addInteraction(this.polygonDrawInteraction);
    
    // 重新绑定事件
    this.polygonDrawInteraction.on('drawend', this._handlePolygonDrawEnd.bind(this));
  }

  // 新增：处理多边形绘制结束
  _handlePolygonDrawEnd(event) {
    const feature = event.feature;
    const geojsonFormat = new GeoJSON({ featureProjection: 'EPSG:3857' });
    const geojsonFeature = geojsonFormat.writeFeatureObject(feature);
    const featureCollection = {
      type: 'FeatureCollection',
      features: [geojsonFeature],
    };

    // 调用回调
    if (this.polygonDrawCallback) {
      this.polygonDrawCallback(featureCollection);
    }

    // 重置绘制状态而不是关闭
    setTimeout(() => {
      this._resetPolygonDraw();
    }, 0);
  }
}