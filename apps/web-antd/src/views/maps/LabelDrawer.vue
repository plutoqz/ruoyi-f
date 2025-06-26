<template>
  <!-- 1. 添加模态框的遮罩层和容器 -->
  <!-- <div class="modal-nooverlay"> -->
    <div class="label-drawer-modal" >
      <!-- 添加一个关闭按钮 -->
      <button class="close-button" @click="handleClose">×</button>

      <div class="control-panel">
        <div class="control-group">
          <h3>1. 绘制与操作</h3>
          <div class="button-group">
            <button @click="handleDrawPolygon">绘制区域</button>
            <button @click="handleClearAll" style="background-color: #f44336;">清除所有</button>
          </div>
        </div>

        <div class="control-group">
          <h3>2. 事项选择</h3>
          <select v-model="selectedIssue">
            <option value="">-- 请选择事项类型 --</option>
            <option value="违规施工">事项1（违规施工）</option>
            <option value="未批先建">事项2（未批先建）</option>
          </select>
          <button @click="handleGenerateText">生成处罚方案</button>
        </div>

        <div class="control-group result-container">
          <h3>处罚方案</h3>
          <div class="result-text">{{ resultText }}</div>
        </div>
      </div>
    </div>
  <!-- </div> -->
</template>

<script setup>
import { ref, watch, onUnmounted, inject, onMounted, computed } from 'vue';

const props = defineProps({
    parcelData: {
        type: Object,
        default: null
    }
});

const emit = defineEmits(['close']);

const mapRef = inject('mapInstance');

// This component now has two modes. isDataMode is true if parcelData is passed.
const isDataMode = computed(() => !!props.parcelData);
const selectedIssue = ref('');
const resultText = ref('');
const drawnOverlays = ref([]); // Stores overlays created BY THIS COMPONENT for cleanup

let mouseTool = null;
let infoWindow = null;

const initializeMouseTool = (mapInstance) => {
    if (!mapInstance || mouseTool) return;
    mouseTool = new AMap.MouseTool(mapInstance);
    mouseTool.on('draw', (event) => {
        const polygon = event.obj;
        drawnOverlays.value.push(polygon);
        mouseTool.close(false); 
        displayPolygonInfo([polygon]); // Pass as an array
    });
};

function displayPolygonInfo(polygons) {
    if (!polygons || polygons.length === 0) return;

    let totalArea = 0;
    polygons.forEach(p => {
        if (p instanceof AMap.Polygon) {
            totalArea += AMap.GeometryUtil.ringArea(p.getPath());
        }
    });

    const center = polygons[0].getBounds().getCenter();
    const content = `<div>区域总面积: <strong>${totalArea.toFixed(0)}</strong> 平方米</div>`;

    if (!infoWindow) {
        infoWindow = new AMap.InfoWindow({ anchor: 'top-center' });
    }
    infoWindow.setContent(content);
    
    if (mapRef.value) {
        infoWindow.open(mapRef.value, center);
    }
}

// This function processes GeoJSON data passed via props
function processGeoJsonData(geoJson) {
    if (!mapRef.value || !geoJson) return;

    cleanupComponentOverlays(); // Clear previous drawings

    // AMap.GeoJSON is a powerful tool to parse GeoJSON and create overlays
    const geoJsonLoader = new AMap.GeoJSON({
        geoJSON: geoJson,
        // Define how to render polygons from the GeoJSON
        getPolygon: (geojsonObject, lngLats) => {
            return new AMap.Polygon({
                path: lngLats,
                strokeColor: "#ff33cc",
                strokeWeight: 4,
                strokeOpacity: 0.9,
                fillOpacity: 0.4,
                fillColor: '#ff33cc',
            });
        }
    });

    // Get the actual polygon objects created by the loader
    const overlays = geoJsonLoader.getOverlays();
    const polygons = overlays.filter(o => o instanceof AMap.Polygon);
    
    if (polygons.length === 0) {
        resultText.value = "错误：提供的文件中未找到有效的面状区域。";
        return;
    }

    // Add polygons to map and track them for cleanup
    mapRef.value.add(polygons);
    drawnOverlays.value = polygons;
    
    // Zoom to the new area
    mapRef.value.setFitView(polygons, false, [100, 100, 100, 100], 16);
    displayPolygonInfo(polygons);
    resultText.value = "已加载已有区域。请选择事项类型并生成方案。";
}


function handleDrawPolygon() {
    if (isDataMode.value) return; // Prevent drawing when in data mode
    if (!mouseTool) {
        resultText.value = "错误：地图工具尚未初始化。";
        return;
    }
    resultText.value = "请在地图上绘制一个区域...";
    mouseTool.polygon({
        strokeColor: "#3388ff",
        strokeOpacity: 1,
        strokeWeight: 2,
        fillColor: "#3388ff",
        fillOpacity: 0.3,
    });
}

// Clears overlays created BY THIS COMPONENT
function cleanupComponentOverlays() {
    if (mapRef.value && drawnOverlays.value.length > 0) {
        mapRef.value.remove(drawnOverlays.value);
    }
    if (infoWindow) {
        infoWindow.close();
    }
    drawnOverlays.value = [];
}


function handleClearAll() {
    cleanupComponentOverlays();
    // If in data mode, re-process the initial data. Otherwise, reset the text.
    if (isDataMode.value) {
        processGeoJsonData(props.parcelData);
    } else {
        resultText.value = '请先绘制区域并选择事项类型。';
    }
}

function handleGenerateText() {
    if (drawnOverlays.value.length === 0) {
        resultText.value = "错误：地图上没有可用的区域用于生成方案。";
        return;
    }
    if (!selectedIssue.value) {
        resultText.value = "提示：请选择一个事项类型！";
        return;
    }

    let totalArea = 0;
    drawnOverlays.value.forEach(p => {
        if(p instanceof AMap.Polygon) {
             totalArea += AMap.GeometryUtil.ringArea(p.getPath());
        }
    });
    const center = drawnOverlays.value[0].getBounds().getCenter();

    resultText.value = `【处罚方案生成结果】
        
事项类型: ${selectedIssue.value}
区域位置: 经度 ${center.getLng().toFixed(6)}, 纬度 ${center.getLat().toFixed(6)}
区域面积: ${totalArea.toFixed(0)} 平方米

处罚依据:
根据《中华人民共和国城乡规划法》第六十四条规定，${getPunishmentByIssue(selectedIssue.value)}

处理意见:
1. 立即停止违法行为。
2. 限期${selectedIssue.value === '违规施工' ? '15' : '30'}日内改正。
3. 处以罚款人民币 ${calculateFine(totalArea)} 元整。

备注: 该处罚方案为系统自动生成，具体执行需结合实际情况调整。`;
}


function handleClose() {
  emit('close');
}

// --- Lifecycle Hooks ---

onMounted(() => {
    if (mapRef.value) {
        initializeMouseTool(mapRef.value);
        if (isDataMode.value) {
            // If component is created with data, process it immediately
            processGeoJsonData(props.parcelData);
        } else {
            resultText.value = '请在地图上绘制一个区域。';
        }
    } else {
        resultText.value = "错误：无法连接到地图实例。";
    }
});

onUnmounted(() => {
    cleanupComponentOverlays();
    // Also ensure mouse tool is fully closed and reset if it exists
    if (mouseTool) {
        mouseTool.close(true);
    }
});

function getPunishmentByIssue(issue) {
  return issue === '违规施工'
    ? "未取得建设工程规划许可证或者未按照建设工程规划许可证的规定进行建设的，由县级以上地方人民政府城乡规划主管部门责令停止建设。"
    : "未经批准进行临时建设的，由所在地城市、县人民政府城乡规划主管部门责令限期拆除，可以并处临时建设工程造价一倍以下的罚款。";
}

function calculateFine(area) {
  const base = area * (area > 500 ? 100 : 80);
  return (Math.round(base / 100) * 100).toLocaleString();
}
</script>

<style scoped>
/* 模态框样式 */
/* .modal-nooverlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
} */
 

.label-drawer-modal {
  /* position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1001; */

  /* background: #f5f5f5;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 450px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  position: relative;  */

  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 450px;
  max-height: 90vh;
  background: #f5f5f5;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  padding-top: 40px; /* 留出关闭按钮空间 */
  overflow-y: auto;

}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #888;
  padding: 5px;
}
.close-button:hover {
  color: #000;
}

/* 原始样式，可能需要微调 */
.control-panel { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; padding-top: 40px; /* 为关闭按钮留出空间 */ }
.control-group { padding: 15px; background-color: white; border-radius: 5px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1); }
.button-group { display: flex; gap: 10px; margin-top: 10px; }
button { flex-grow: 1; padding: 10px 15px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
button:hover { background-color: #0056b3; }
select { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
.result-container { flex-grow: 1; display: flex; flex-direction: column; }
.result-text { flex-grow: 1; margin-top: 10px; padding: 15px; background-color: #fafafa; border: 1px solid #eee; border-radius: 4px; white-space: pre-wrap; font-family: 'Courier New', Courier, monospace; min-height: 150px; }
</style>