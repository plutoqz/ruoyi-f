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
    this.polygonDrawInteraction = null;
    this.polygonDrawLayer = null;
    this.polygonDrawCallback = null;

    // **修改：用于主题切换的属性**
    this.defaultLayers = []; // 存储默认的矢量底图和注记图层
    this.satelliteLayers = []; // 存储卫星影像和注记图层
    this.currentTheme = 'normal'; // 当前主题
  }

  async init(initialView) {
    const center = fromLonLat(initialView.center); // OL uses EPSG:3_857, transform from WGS84
    
    let allBaseLayers = []; // 用一个数组来存储所有可能的底图
    if (this.provider === 'tianditu') {
      // **核心修改：逐一创建、存储并添加图层到初始化数组，以确保稳定性**

      // 1. 天地图矢量底图 (默认可见)
      const vecLayer = new TileLayer({
        source: new XYZ({
          url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${this.key}`,
          crossOrigin: 'anonymous',
        }),
        visible: true, 
      });
      this.defaultLayers.push(vecLayer);
      allBaseLayers.push(vecLayer);

      // 2. 天地图矢量注记 (默认可见)
      const cvaLayer = new TileLayer({
        source: new XYZ({
          url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=${this.key}`,
          crossOrigin: 'anonymous',
        }),
        zIndex: 1,
        visible: true,
      });
      this.defaultLayers.push(cvaLayer);
      allBaseLayers.push(cvaLayer);

      // 3. 天地图卫星影像 (默认不可见)
      const satelliteLayer = new TileLayer({
        source: new XYZ({
          url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=img_w&x={x}&y={y}&l={z}&tk=${this.key}`,
          crossOrigin: 'anonymous',
        }),
        visible: false,
      });
      this.satelliteLayers.push(satelliteLayer);
      allBaseLayers.push(satelliteLayer);

      // 4. 天地图影像注记 (默认不可见)
      const satelliteAnnoLayer = new TileLayer({
        source: new XYZ({
          url: `https://t{0-7}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=${this.key}`,
          crossOrigin: 'anonymous',
        }),
        zIndex: 1,
        visible: false,
      });
      this.satelliteLayers.push(satelliteAnnoLayer);
      allBaseLayers.push(satelliteAnnoLayer);

    } else { // 'osm'
      allBaseLayers.push(new TileLayer({
        source: new XYZ({
          url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          crossOrigin: 'anonymous',
        }),
      }));
    }

    this.map = new Map({
      target: this.containerId,
      layers: allBaseLayers, // **使用逐步构建的数组进行初始化**
      view: new View({
        center: center,
        zoom: initialView.zoom,
        constrainResolution: true,
      }),
      controls: [], // Hide default controls
    });
    
    this._createInfoOverlay();
    return this;
  }

  // **核心修改：使用 setVisible 切换主题，而不是 add/remove layer**
  setTheme(theme) {
    if (!this.map || this.currentTheme === theme || this.provider !== 'tianditu') {
      return;
    }

    if (theme === 'satellite') {
      // 切换到卫星模式：隐藏默认图层，显示卫星图层
      this.defaultLayers.forEach(layer => layer.setVisible(false));
      this.satelliteLayers.forEach(layer => layer.setVisible(true));
      console.log('[OpenLayersAdapter] Switched to satellite theme.');
    } else { // theme === 'normal'
      // 切换到普通模式：隐藏卫星图层，显示默认图层
      this.satelliteLayers.forEach(layer => layer.setVisible(false));
      this.defaultLayers.forEach(layer => layer.setVisible(true));
      console.log('[OpenLayersAdapter] Switched to normal theme.');
    }

    this.currentTheme = theme;
  }

  destroy() {
    if (this.map) {
      this.map.setTarget(null);
      this.map = null;
    }
    if (this.layers && typeof this.layers.clear === 'function') {
      this.layers.clear();
    }
    if (this.polygonDrawInteraction) this.map.removeInteraction(this.polygonDrawInteraction);
    this.layers = null;
    this.drawInteraction = null;
    this.drawLayer = null;
    this.infoOverlay = null;
    // **新增：清理主题图层引用**
    this.defaultLayers = [];
    this.satelliteLayers = [];
  }

  getMapView() {
    if (!this.map) return null;
    const view = this.map.getView();
    const center3857 = view.getCenter();
    return {
      center: toLonLat(center3857),
      zoom: view.getZoom(),
    };
  }
  
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
    const layerToRemove = this.layers.get(layerId);
    if (layerToRemove) {
      try {
        this.map.removeLayer(layerToRemove);
        this.layers.delete(layerId);
      } catch (e) {
        console.error(`[OpenLayersAdapter] Error removing layer ${layerId}:`, e);
      }
    }
  }

  toggleLayerVisibility(layerId, isVisible) {
    const layerToToggle = this.layers.get(layerId);
    if (layerToToggle) {
      layerToToggle.setVisible(isVisible);
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
      // **BUG修复：修正了获取图层和其属性的方式**
      this.layers.forEach((vectorLayer, layerId) => {
        if (vectorLayer.getVisible()) { 
          vectorLayer.getSource().forEachFeatureInExtent(extent, (feature) => {
            const props = {...feature.getProperties()};
            delete props.geometry;
            selectedFeatures.push({
              layerId: layerId,
              layerName: vectorLayer.get('name'),
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
      this.infoOverlayElement.className = 'custom-info-window';
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
      const area = feature.getGeometry().getArea();
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
    this.polygonDrawCallback = onDrawEndCallback;
    
    if (this.polygonDrawInteraction) {
      this._resetPolygonDraw();
      return;
    }

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

    this.polygonDrawInteraction = new Draw({
      source: this.polygonDrawSource,
      type: 'Polygon',
    });
    this.map.addInteraction(this.polygonDrawInteraction);

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

  _resetPolygonDraw() {
    if (this.polygonDrawSource) this.polygonDrawSource.clear();
  }

  _handlePolygonDrawEnd(event) {
    const feature = event.feature;
    const geojsonFormat = new GeoJSON({ featureProjection: 'EPSG:3857' });
    const geojsonFeature = geojsonFormat.writeFeatureObject(feature);
    const featureCollection = {
      type: 'FeatureCollection',
      features: [geojsonFeature],
    };

    if (this.polygonDrawCallback) {
      this.polygonDrawCallback(featureCollection);
    }

    setTimeout(() => {
      this._resetPolygonDraw();
    }, 0);
  }
}
