<template>
    <div class="knowledge-graph-editor-container">
      <div class="file-operations-panel">
        <div class="panel-section">
          <h3 class="panel-title">知识图谱数据源</h3>
          <p class="panel-description">输入Cypher查询语句从后端加载图谱，或上传文件进行本地更新。</p>
          <textarea v-model="cypherQuery" placeholder="输入您的 Cypher 查询语句 (例如 MATCH (n) RETURN n LIMIT 10)..." rows="2" class="cypher-input"></textarea>
          <button @click="loadGraphFromNeo4j" class="action-button load-button" :disabled="loading">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-database-down" viewBox="0 0 16 16" style="margin-right: 8px;">
              <path d="M12.5 9a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"/>
              <path d="M12.5 9a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z M8 13a4.5 4.5 0 0 0 4.492-4.006C11.529 8.296 10.75 8 9.5 8S7.471 8.296 6.508 8.994A4.501 4.501 0 0 0 8 13Z"/>
              <path d="M12.5 9a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm-4.21-1.037L6.237 9.677a.5.5 0 0 1-.707-.707l2.5-2.5a.5.5 0 0 1 .707 0l2.5 2.5a.5.5 0 0 1-.707.707L8.5 7.707V11.5a.5.5 0 0 1-1 0V7.707Z"/>
              <path d="M8 1c-1.573 0-3.022.289-4.096.777C2.875 2.245 2 2.993 2 4s.875 1.755 1.904 2.223C4.978 6.711 6.427 7 8 7s3.022-.289 4.096-.777C13.125 5.755 14 5.007 14 4s-.875-1.755-1.904-2.223C11.022 1.289 9.573 1 8 1ZM2 4.234V11c0 1.007.875 1.755 1.904 2.223C4.978 13.711 6.427 14 8 14s3.022-.289 4.096-.777C13.125 12.755 14 12.007 14 11V4.234c-.308.202-.652.378-.999.518C12.022 5.245 10.573 5.5 8 5.5s-2.978-.255-4.001-.748a4.495 4.495 0 0 1-.999-.518Z"/>
            </svg>
            {{ loading ? '加载中...' : '从Neo4j加载图谱' }}
          </button>
          <div class="graph-stats" v-if="nodeCount > 0 || edgeCount > 0">
              <p>节点数: {{ nodeCount }} | 关系数: {{ edgeCount }}</p>
          </div>
          <!-- <div class="legend-container" v-if="legendData.length > 0">
              <h4>图例:</h4>
              <ul>
                  <li v-for="item in legendData" :key="item.label">
                      <span class="legend-color-box" :style="{ backgroundColor: item.color }"></span>
                      {{ item.label }} ({{ item.count }})
                  </li>
              </ul>
          </div> -->
        </div>
  
        <div class="panel-section">
          <h4 class="panel-subtitle">本地文件更新 (前端预览)</h4>
          <p class="panel-description">
              选择文件进行前端图谱更新预览。支持 <b>Cytoscape JSON</b> 或 <b>GeoJSON</b> 文件。
              此操作不会修改后端数据库。
          </p>
  
          <div class="file-input-group">
              <label for="jsonFileUploadInput" class="file-input-label small-label">Cytoscape JSON 更新文件 (.json):</label>
              <input type="file" @change="handleJsonFileUpload('cytoscape', $event)" accept=".json" class="file-input" id="jsonFileUploadInput" />
              <span v-if="selectedJsonFileName" class="selected-file-name">{{ selectedJsonFileName }}</span>
          </div>
  
          <div class="file-input-group">
              <label for="geoJsonFileUploadInput" class="file-input-label small-label">GeoJSON 更新文件 (.geojson, .json):</label>
              <input type="file" @change="handleJsonFileUpload('geojson', $event)" accept=".geojson,.json" class="file-input" id="geoJsonFileUploadInput" />
              <span v-if="selectedGeoJsonFileName" class="selected-file-name">{{ selectedGeoJsonFileName }}</span>
          </div>
          <button @click="processAndApplyUpdates" class="action-button" :disabled="!canApplyUpdates">
            处理并应用前端更新
          </button>
  
          <div v-if="fileDataPreview" class="file-preview-container">
            <h5 class="preview-title">待处理数据预览 (部分):</h5>
            <pre class="file-preview-content">{{ fileDataPreview }}</pre>
          </div>
        </div>
  
        <div class="panel-section">
          <h4 class="panel-subtitle">大模型集成 (示例)</h4>
          <p class="panel-description">输入您的大模型API密钥。</p>
          <input type="text" v-model="largeModelApiKey" placeholder="AIzaSyCNdBbH7zC_lTamkfS_vzEf9nyvsOPegZ4" class="text-input" />
          <button @click="useLargeModel" class="action-button secondary-button" :disabled="!largeModelApiKey">
            调用大模型 (示例)
          </button>
            <button @click="logInstance" class="action-button secondary-button" style="margin-top: 10px;">检查图谱实例状态</button>
        </div>
  
          <div v-if="updateStatus" class="update-status-message">
          {{ updateStatus }}
        </div>
  
        <div v-if="isMapModalVisible" class="map-modal-placeholder">
            地图弹窗 (位置: {{ nodeLocationName }}) - <button @click="isMapModalVisible = false">关闭</button>
        </div>
  
      </div>
      <div class="knowledge-graph-panel">
        <div id="cytoscape-container" ref="cytoscapeContainerRef" class="cytoscape-graph-view">
            <div v-if="loading" class="loading-overlay">
              <div class="spinner"></div>
              <p>正在加载图谱...</p>
            </div>
        </div>
      </div>
    </div>
  </template>

<script setup>
import { ref, onMounted, nextTick, onUnmounted, computed } from 'vue';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
cytoscape.use(fcose);

const cytoscapeContainerRef = ref(null);
const cytoscapeInstance = ref(null);
const loading = ref(false);
const cypherQuery = ref('MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 25');

const nodeCount = ref(0);
const edgeCount = ref(0);
const legendData = ref([]);
const selectedNode = ref(null);
const selectedEdge = ref(null);

const uploadedJsonFile = ref(null);
const uploadedGeoJsonFile = ref(null);

const selectedJsonFileName = ref('');
const selectedGeoJsonFileName = ref('');

const fileDataForCytoscape = ref(null);
const fileDataPreview = ref('');

const largeModelApiKey = ref('');
const updateStatus = ref('');
const nodeLocationName = ref('');
const isMapModalVisible = ref(false);

const isInfoPanelVisible = ref(false); // Controls visibility of the new panel
const lastUpdateSummary = ref({ // To store summary of the last file update
    addedNodes: 0,
    addedEdges: 0,
    // We can extend this if we implement modify/delete tracking from files
    // modifiedNodes: 0,
    // removedNodes: 0,
    // removedEdges: 0,
    sourceFile: '',
    timestamp: ''
});
const infoPanelPinState = ref(false); // To keep panel open

const PREVIOUS_TIME_TAG = '202400'; // Assumed previous state timestamp
let CURRENT_TIME_TAG = ''; // Will be set from the first GeoJSON feature's 'time'

const genAI = new GoogleGenAI({ apiKey: 'AIzaSyCNdBbH7zC_lTamkfS_vzEf9nyvsOPegZ4' });

const labelColors = {};
let colorIndex = 0;
const predefinedColors = [
  '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6',
  '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9A6324', '#fffac8', '#800000', '#aaffc3',
  '#808000', '#ffd8b1', '#000075', '#808080', '#2F4F4F', '#556B2F'
];

// Base styles for Cytoscape elements
const baseCytoscapeStyles = [
    { selector: 'node', style: {
        'label': 'data(name)', 'background-color': 'data(color)',
        'width': 'mapData(area, 40, 80, 30, 70)', // Example, might need adjustment or removal if 'area' isn't common
        'height': 'mapData(area, 40, 80, 30, 70)',// Example
        'font-size': '10px', 'color': '#ffffff', 'text-outline-color': '#333333',
        'text-outline-width': 2, 'text-valign': 'center', 'text-halign': 'center',
        'border-width': 2, 'border-color': '#555555', 'min-zoomed-font-size': 8
    }},
    { selector: 'node[type="村"]', style: { 'background-color': '#50E3C2', 'shape': 'round-rectangle', 'border-color': '#2CA080', 'width': 60, 'height': 40 } },
    { selector: 'node[type="地块"]', style: { 'background-color': '#F5A623', 'shape': 'ellipse', 'border-color': '#B57603' } },
    { selector: 'node[type="指标"]', style: { 'background-color': '#BD10E0', 'shape': 'diamond', 'border-color': '#8D00B0', 'width': 50, 'height': 50 } },
    { selector: 'node[type="Virtual"]', style: { 'background-color': '#B0B0B0', 'shape': 'star', 'text-outline-color': '#fff', 'color':'#333', 'width':30, 'height':30, 'label': 'data(name)' } },
    { selector: 'node[type="地理要素"]', style: { 'background-color': '#4A90E2', 'shape': 'hexagon', 'width': 45, 'height': 45 } }, // Style for generic GeoJSON nodes
    { selector: 'edge', style: {
        'width': 1.5, 'line-color': '#88ada6', 'target-arrow-color': '#88ada6',
        'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'label': 'data(label)',
        'font-size': '9px', 'color': '#333333', 'text-background-opacity': 0.8,
        'text-background-color': '#ffffff', 'text-background-padding': '2px', 'min-zoomed-font-size': 7
    }},
    { selector: 'node:selected', style: { 'border-color': '#e91e63', 'border-width': 4, 'box-shadow': '0 0 12px #e91e63', 'z-index': 99 }},
    { selector: 'edge:selected', style: { 'line-color': '#e91e63', 'target-arrow-color': '#e91e63', 'width': 3, 'z-index': 99 }},
    { selector: '.updated-node', style: { 'background-color': '#7ED321', 'border-color': '#5CB800', 'shape':'star' }} // Highlights nodes/edges from file updates
];

// Function to get a color for a node based on its labels (cached)
const getColorForLabelsCached = (labels) => {
    const primaryLabel = labels && labels.length ? labels[0] : 'Unknown';
    if (!labelColors[primaryLabel]) {
      labelColors[primaryLabel] = predefinedColors[colorIndex % predefinedColors.length];
      colorIndex++;
    }
    return labelColors[primaryLabel];
};

// Computed property to determine if the "Apply Updates" button should be enabled
const canApplyUpdates = computed(() => {
    const fileSelected = uploadedJsonFile.value || uploadedGeoJsonFile.value;
    return fileSelected && cytoscapeInstance.value;
});

// Initializes Cytoscape instance if it doesn't exist, or returns existing one
const initializeOrGetInstance = () => {
    if (cytoscapeContainerRef.value && !cytoscapeInstance.value) {
        console.log("initializeOrGetInstance: Cytoscape instance is null, creating new empty instance.");
        try {
            cytoscapeInstance.value = cytoscape({
                container: cytoscapeContainerRef.value,
                elements: [],
                style: baseCytoscapeStyles,
                layout: { name: 'preset' } // Start with a preset layout
            });
            // Bind event handlers ONCE here
            cytoscapeInstance.value.on('tap', 'node', (e) => {
                if (!cytoscapeInstance.value) return;
                cytoscapeInstance.value.elements().unselect(); // Unselect others
                e.target.select();
                selectedNode.value = e.target.data();
                console.log(e.target.data())
                updateStatus.value = `选中节点: ${e.target.data('name') || e.target.id()}`;
                const loc = e.target.data('村') || e.target.data('市') || e.target.data('区镇') || e.target.data('QSDWMC'); // Added QSDWMC from GeoJSON
                if (loc) {
                    nodeLocationName.value = loc;
                    isMapModalVisible.value = true;
                } else {
                    isMapModalVisible.value = false;
                }
            });
            cytoscapeInstance.value.on('tap', 'edge', (e) => {
                if (!cytoscapeInstance.value) return;
                cytoscapeInstance.value.elements().unselect(); // Unselect others
                e.target.select();
                selectedEdge.value = e.target.data();
                updateStatus.value = `选中关系: ${e.target.data('label') || e.target.data('type') || e.target.id()}`;
            });
            cytoscapeInstance.value.on('tap', (event) => {
                if (!cytoscapeInstance.value) return;
                if (event.target === cytoscapeInstance.value) { // Tap on background
                    cytoscapeInstance.value.elements().unselect();
                    selectedNode.value = null;
                    selectedEdge.value = null;
                    isMapModalVisible.value = false;
                    updateStatus.value = "图谱交互中。";
                }
            });
            console.log("initializeOrGetInstance: Empty Cytoscape instance CREATED and event handlers bound.");
            updateStatus.value = "空图谱已初始化。请加载数据或上传文件。";
        } catch (e) {
            console.error("Error initializing empty Cytoscape instance:", e);
            updateStatus.value = "错误：初始化空图谱失败。";
            cytoscapeInstance.value = null;
        }
    } else if (cytoscapeContainerRef.value && cytoscapeInstance.value) {
        // console.log("initializeOrGetInstance: Cytoscape instance already exists.");
    } else if (!cytoscapeContainerRef.value) {
        console.error("initializeOrGetInstance: Cannot initialize, Cytoscape container ref is not set.");
    }
    return cytoscapeInstance.value;
};

onMounted(async () => {
    await nextTick(); // Ensure DOM is ready
    initializeOrGetInstance();
    if (!cytoscapeContainerRef.value) {
        console.error("onMounted: Cytoscape container DOM element not found.");
        updateStatus.value = "图谱容器加载失败。";
    }
});

onUnmounted(() => {
    if (cytoscapeInstance.value) {
        console.log("onUnmounted: Destroying Cytoscape instance.");
        cytoscapeInstance.value.destroy();
        cytoscapeInstance.value = null;
    }
});

// Logs current Cytoscape instance status (for debugging)
const logInstance = () => {
    console.log("Current cytoscapeInstance.value (manual check):", cytoscapeInstance.value);
    if (cytoscapeInstance.value) {
        console.log("Instance nodes (manual check):", cytoscapeInstance.value.nodes().length);
        // Replace alert with a more user-friendly notification if needed
        alert(`图谱实例存在。节点数: ${cytoscapeInstance.value.nodes().length}, 关系数: ${cytoscapeInstance.value.edges().length}`);
    } else {
        alert("图谱实例不存在 (null)。");
    }
};

// Loads graph data from Neo4j via backend API
const loadGraphFromNeo4j = async () => {
    loading.value = true;
    selectedNode.value = null;
    selectedEdge.value = null;
    legendData.value = [];
    updateStatus.value = "正在从 Neo4j 加载数据...";
    console.log("--- loadGraphFromNeo4j: Initiating graph load ---");

    const currentInstance = initializeOrGetInstance();
    if (!currentInstance) {
        updateStatus.value = "错误：无法获取图谱实例以加载数据。";
        loading.value = false;
        return;
    }

    try {
      const res = await axios.post('/neo4j/query', {
      cypher: cypherQuery.value,
    })

    if (!res.data || !res.data.data) {
      console.error('返回数据格式不正确:', res.data)
      loading.value = false
      return
    }
    // const finishTime2 = performance.now();
    // console.log(finishTime2 - startTime);
    // 用于存储已添加节点的 id，避免重复
    const nodesMap = new Map()
    const nodes = [] // 将放置所有节点对象
    const edges = [] // 将放置所有关系对象
    const tempedges = [] //放置第一次遍历的边
    // 第一次遍历：处理节点（包含 labels 与 properties）
    res.data.data.forEach(record => {
      Object.keys(record).forEach(key => {
        const item = record[key]
        if (item && item.labels && item.properties) {
          const nodeId = item.elementid    // 后端确保了 id 字段
          if (!nodesMap.has(nodeId)) {
            nodesMap.set(nodeId, true)
            // 获取显示名称：优先使用 properties.name，否则取第一个 label
            const displayName = item.properties.name || (item.labels.length ? item.labels[0] : '')
            nodes.push({
              data: {
                setid:item.id,
                ...item.properties,
                id: nodeId,
                name: displayName,
                labels: item.labels,
                color: getColorForLabelsCached(item.labels)  // 设置节点颜色
              }
            });
          }
        }
        if (item && item.start && item.end && item.properties && item.type){
          tempedges.push(item);
        }
      })
    })
    for (const item of tempedges) {
      if (!nodesMap.has(item.start)) {
        nodesMap.set(item.start, true)
        nodes.push({
          data: {
            id: item.start,
            name: '',       // 虚拟节点没有名称
            color: "#888"   // 默认颜色
          }
        })
      }
      if (!nodesMap.has(item.end)) {
        nodesMap.set(item.end, true)
        nodes.push({
          data: {
            id: item.end,
            name: '',       // 虚拟节点没有名称
            color: "#888"   // 默认颜色
          }
        })
      }
      const edgeId = `${item.start}_${item.end}_${item.type}`
      edges.push({
        data: {
          id: edgeId,
          source: item.start,
          target: item.end,
          type: item.type,
          ...item.properties
        }
      })
    }
        
        console.log(`Processed ${nodes.length} nodes and ${edges.length} edges for Neo4j load.`);

        currentInstance.elements().remove(); // Clear existing elements
        console.log("Elements cleared from existing instance.");

        if (nodes.length > 0 || edges.length > 0) {
            currentInstance.add([...nodes, ...edges]);
            console.log("New elements added to instance from Neo4j.");
        } else {
            console.warn("No nodes or edges processed from Neo4j data.");
        }

        await nextTick(); // Wait for DOM updates

        console.log("Running FCose layout on instance (Neo4j load).");
        currentInstance.layout({
            name: 'fcose',
            animate: false, // Can be true for nicer effect, but false for speed on large graphs
            randomize: true,
            nodeRepulsion: 10000,
            idealEdgeLength: 60, // Adjusted from 50
            quality: "default",
            fit: true,
            padding: 30,
            // Consider nodeDimensionsIncludeLabels: true if labels are large and cause overlap
        }).run();
        console.log("FCose layout run completed for Neo4j load.");

        nodeCount.value = currentInstance.nodes().length;
        edgeCount.value = currentInstance.edges().length;

        // Generate legend data
        const legendMap = {};
        currentInstance.nodes().forEach(node => {
            const primaryLabel = node.data('type') || (node.data('labels') && node.data('labels').length ? node.data('labels')[0] : '其他');
            if (!legendMap[primaryLabel]) {
                legendMap[primaryLabel] = {
                    label: primaryLabel,
                    count: 0,
                    color: node.style('background-color') // Get actual rendered color
                };
            }
            legendMap[primaryLabel].count++;
        });
        legendData.value = Object.values(legendMap);

        if (nodeCount.value > 0 || edgeCount.value > 0) {
            updateStatus.value = `图谱加载并渲染完成！节点: ${nodeCount.value}, 关系: ${edgeCount.value}`;
        } else {
            updateStatus.value = "图谱加载完成，但未渲染任何节点或关系。请检查查询和数据。";
        }

    } catch (err) {
        console.error('查询或渲染图谱失败 (Neo4j):', err);
        updateStatus.value = `Neo4j 查询失败: ${err.response?.data?.error || err.message || '请检查后端服务或查询语法。'}`;
    } finally {
        requestAnimationFrame(() => { // Ensure operations like resize/fit happen after layout
            if (currentInstance && currentInstance.elements().length > 0) {
                currentInstance.resize(); // Adjust to container size
                // currentInstance.fit(undefined, 30); // Fit with padding, already done by layout if fit:true
            }
            loading.value = false;
            console.log("--- loadGraphFromNeo4j: Graph load process finished ---");
        });
    }
};


// Handles file selection for JSON or GeoJSON files
const handleJsonFileUpload = (type, event) => {
    const file = event.target.files[0];
    if (file) {
        // Reset previous selections
        uploadedJsonFile.value = null; selectedJsonFileName.value = '';
        uploadedGeoJsonFile.value = null; selectedGeoJsonFileName.value = '';
        fileDataForCytoscape.value = null; // Reset processed data

        if (type === 'cytoscape') {
            uploadedJsonFile.value = file;
            selectedJsonFileName.value = file.name;
            fileDataPreview.value = `Cytoscape JSON 文件 "${file.name}" 已选择。点击下方按钮处理。`;
        } else if (type === 'geojson') {
            uploadedGeoJsonFile.value = file;
            selectedGeoJsonFileName.value = file.name;
            fileDataPreview.value = `GeoJSON 文件 "${file.name}" 已选择。点击下方按钮处理。`;
        }
    } else { // File selection cancelled
        if (type === 'cytoscape') { uploadedJsonFile.value = null; selectedJsonFileName.value = ''; }
        if (type === 'geojson') { uploadedGeoJsonFile.value = null; selectedGeoJsonFileName.value = ''; }
    }
};

// Processes the selected file (Cytoscape JSON or GeoJSON) and then applies updates
const processAndApplyUpdates = async () => {
    fileDataForCytoscape.value = null; // Reset from previous attempts
    const currentInstance = initializeOrGetInstance();
    if (!currentInstance) {
        updateStatus.value = "错误：图谱实例不可用，无法应用更新。";
        return;
    }

    loading.value = true; // Show loading indicator

    if (uploadedJsonFile.value) {
        await processCytoscapeJsonFile();
    } else if (uploadedGeoJsonFile.value) {
        await processGeoJsonFile();
    } else {
        updateStatus.value = "请选择一个有效的更新文件 (Cytoscape JSON 或 GeoJSON)。";
        loading.value = false;
        return;
    }

    if (fileDataForCytoscape.value) {
        applyClientSideUpdates(fileDataForCytoscape.value);
    } else {
        // Error message already set by processing functions
        // updateStatus.value = "文件处理失败或未生成有效图谱数据，无法应用更新。";
    }
    loading.value = false; // Hide loading indicator
};

// Processes an uploaded Cytoscape JSON file
const processCytoscapeJsonFile = async () => {
    if (!uploadedJsonFile.value) return;
    updateStatus.value = `正在处理 Cytoscape JSON 文件: ${uploadedJsonFile.value.name}...`;
    try {
        const fileText = await uploadedJsonFile.value.text();
        const jsonData = JSON.parse(fileText);
        // Basic validation for Cytoscape-like structure
        if (jsonData.elements || jsonData.addNodes || jsonData.addEdges || jsonData.updateNodes || jsonData.removeElements) {
            fileDataForCytoscape.value = jsonData; // Store the raw JSON data for now
            fileDataPreview.value = JSON.stringify(jsonData, null, 2).substring(0, 500) + (JSON.stringify(jsonData).length > 500 ? '...' : '');
            updateStatus.value = "Cytoscape JSON 文件处理完成。准备应用更新...";
        } else {
            updateStatus.value = "错误：选择的JSON文件似乎不是有效的 Cytoscape 更新格式。";
            fileDataForCytoscape.value = null;
        }
    } catch (error) {
        console.error("Error processing Cytoscape JSON file:", error);
        updateStatus.value = `Cytoscape JSON 文件处理失败: ${error.message}`;
        fileDataForCytoscape.value = null;
    }
};

// Processes an uploaded GeoJSON file and converts it to Cytoscape format
const processGeoJsonFile = async () => {
    if (!uploadedGeoJsonFile.value) return;
    updateStatus.value = `正在处理 GeoJSON 文件: ${uploadedGeoJsonFile.value.name}...`;

    try {
        const fileText = await uploadedGeoJsonFile.value.text();
        const geojsonData = JSON.parse(fileText);

        if (!geojsonData.features || !Array.isArray(geojsonData.features) || geojsonData.features.length === 0) {
            throw new Error('GeoJSON 必须包含一个 "features" 数组且不能为空。');
        }

        // Use the 'time' from the first feature as the current update time for this batch
        CURRENT_TIME_TAG = String(geojsonData.features[0].properties.time || new Date().getFullYear() + '00'); // Fallback if time is missing

        const nodesToAdd = [];
        const edgesToAdd = [];
        const villageDataMap = new Map(); // To store aggregated data for indicators: villageName -> {stats}
        const addedVillages = new Set(); // To track villages added in this batch for CURRENT_TIME_TAG

        geojsonData.features.forEach(feature => {
            if (feature.type !== 'Feature' || !feature.properties) return;

            const props = feature.properties;
            const TBBH = String(props.TBBH);
            const villageName = String(props.ZLDWMC); // Assuming ZLDWMC is village name
            const changetype = props.changetype;
            const area = parseFloat(props.Shape_Area || props.TBMJ || 0); // Prioritize Shape_Area, then TBMJ
            const zzsxmc = props.ZZSXMC; // 种植状态
            const dlmc = props.DLMC; // 地类名称
            // Use BSM or OBJECTID as a base for feature ID if TBBH is not granular enough for some reason
            const featureIdBase = props.BSM || props.OBJECTID || TBBH;


            // 1. Village Node (村)
            const villageIdCurrent = `village_${villageName}_${CURRENT_TIME_TAG}`;
            if (villageName && !addedVillages.has(villageIdCurrent)) {
                nodesToAdd.push({
                    data: {
                        id: villageIdCurrent,
                        name: villageName,
                        type: '村', // For styling and identification
                        更新时间: CURRENT_TIME_TAG,
                        labels: ['村'],
                        color: getColorForLabelsCached(['村'])
                    }
                });
                addedVillages.add(villageIdCurrent);
            }

            // 2. Plot Node (地块 - New Version)
            const plotIdCurrent = `plot_${featureIdBase}_${CURRENT_TIME_TAG}`;
            nodesToAdd.push({
                data: {
                    id: plotIdCurrent,
                    TBBH: TBBH,
                    name: `地块-${TBBH}`, // Display name
                    地块编号: TBBH,
                    地块类型: dlmc,
                    地块面积: area,
                    //地块长度: props.Shape_Leng, // Add if needed
                    种植状态: zzsxmc,
                    更新状态: changetype,
                    更新时间: CURRENT_TIME_TAG,
                    village: villageName, // Store for easy access
                    type: '地块', // For styling
                    labels: ['地块'],
                    color: getColorForLabelsCached(['地块']),
                    ...props // Include all original GeoJSON properties
                }
            });

            // 3. "隶属" Relationship (地块 -> 村)
            if (villageName) {
                edgesToAdd.push({
                    data: {
                        id: `reled_${plotIdCurrent}_to_${villageIdCurrent}`,
                        source: plotIdCurrent,
                        target: villageIdCurrent,
                        label: '隶属',
                        type: '隶属关系'
                    }
                });
            }

            // 4. "继承" Relationship (新地块 -> 旧地块)
            // We assume the old plot ID would follow this pattern if it existed
            const plotIdPrevious = `plot_${featureIdBase}_${PREVIOUS_TIME_TAG}`;
            // The actual check for prev node existence happens in applyClientSideUpdates
            edgesToAdd.push({ // Add speculatively; applyClientSideUpdates will filter if prev node doesn't exist
                data: {
                    id: `relin_${plotIdCurrent}_from_${plotIdPrevious}`,
                    source: plotIdCurrent, // New
                    target: plotIdPrevious, // Old
                    label: '继承',
                    type: '继承关系'
                }
            });
            
            // 5. Aggregate data for indicators
            if (villageName) {
                if (!villageDataMap.has(villageName)) {
                    villageDataMap.set(villageName, {
                        create_area: 0.0, delete_area: 0.0,
                        modify_inc_area: 0.0, modify_dec_area: 0.0,
                        crop_area_change: 0.0, // change in '种植粮食作物' area
                        uncultivated_change: 0.0, // change in '未耕种' area
                        create_count: 0, delete_count: 0,
                        original_features: [] // Store original features for modify logic
                    });
                }
                const stats = villageDataMap.get(villageName);
                stats.original_features.push(props); // Store for modify calculations

                if (changetype === 'create') {
                    stats.create_count++;
                    stats.create_area += area;
                    if (zzsxmc === '种植粮食作物') stats.crop_area_change += area;
                    else if (zzsxmc === '未耕种') stats.uncultivated_change += area;
                } else if (changetype === 'delete') {
                    stats.delete_count++;
                    stats.delete_area += area;
                    if (zzsxmc === '种植粮食作物') stats.crop_area_change -= area;
                    else if (zzsxmc === '未耕种') stats.uncultivated_change -= area;
                } else if (changetype === 'modify') {
                    // For 'modify', we need the previous area.
                    // This is tricky frontend-only. The Python script queries DB.
                    // Here, we'll store the 'current' area from GeoJSON.
                    // The actual delta calculation will happen in applyClientSideUpdates if prev. node found.
                }
            }
        });

        fileDataForCytoscape.value = { nodesToAdd, edgesToAdd, villageDataMap, currentTimeTag: CURRENT_TIME_TAG };
        fileDataPreview.value = JSON.stringify({
            nodes: nodesToAdd.slice(0, 2),
            edges: edgesToAdd.slice(0, 2),
            villages_count: villageDataMap.size
        }, null, 2) + "\n...(更多数据已处理)";
        
        updateStatus.value = `GeoJSON 处理完成: ${nodesToAdd.length} 个潜在节点, ${edgesToAdd.length} 条潜在边。准备应用更新...`;

    } catch (error) {
        console.error("Error processing GeoJSON file:", error);
        updateStatus.value = `GeoJSON 文件处理失败: ${error.message}`;
        fileDataForCytoscape.value = null;
    }
};


// Helper function to get previous indicator value from Cytoscape graph
const getPreviousIndicatorValue = (cyInstance, villageName, indicatorName, timeTag) => {
    if (!cyInstance) return 0.0;
    const indicatorId = `indicator_${villageName}_${indicatorName}_${timeTag}`;
    const node = cyInstance.getElementById(indicatorId);
    if (node.length) {
        return parseFloat(node.data('指标值') || 0.0);
    }
    return 0.0;
};


const applyClientSideUpdates = (dataToApply) => {
    const cy = cytoscapeInstance.value;
    if (!cy) {
        updateStatus.value = "错误：图谱实例不可用，无法应用更新。";
        return;
    }
    if (!dataToApply || !dataToApply.nodesToAdd || !dataToApply.edgesToAdd || !dataToApply.villageDataMap) {
        updateStatus.value = "错误：待应用数据无效。";
        return;
    }
    console.log("Applying client-side updates with data:", dataToApply);

    const { nodesToAdd, edgesToAdd, villageDataMap, currentTimeTag } = dataToApply;
    let changesMade = false;

    // 1. Add Plot and Village nodes from GeoJSON processing
    nodesToAdd.forEach(nodeInfo => {
        if (nodeInfo && nodeInfo.data && nodeInfo.data.id) {
            if (!cy.getElementById(nodeInfo.data.id).length) {
                cy.add({
                    group: 'nodes',
                    data: nodeInfo.data,
                    position: nodeInfo.position,
                    classes: 'updated-node'
                });
                changesMade = true;
            } else { // Node already exists, potentially update its properties
                // cy.getElementById(nodeInfo.data.id).data(nodeInfo.data); // Simple overwrite
                // changesMade = true;
                console.warn(`Node ${nodeInfo.data.id} already exists. Skipping addition, consider update logic.`);
            }
        }
    });

    // 2. Add "隶属" and "继承" (Plot) relationships
    edgesToAdd.forEach(edgeInfo => {
        if (edgeInfo && edgeInfo.data && edgeInfo.data.id && edgeInfo.data.source && edgeInfo.data.target) {
            // For "继承" edges, ensure the target (old node) actually exists
            if (edgeInfo.data.label === '继承' && !cy.getElementById(edgeInfo.data.target).length) {
                console.warn(`Skipping '继承' edge ${edgeInfo.data.id}: old target node ${edgeInfo.data.target} not found.`);
                return; // Skip this edge
            }
            if (!cy.getElementById(edgeInfo.data.id).length) {
                if (cy.getElementById(edgeInfo.data.source).length && cy.getElementById(edgeInfo.data.target).length) {
                    cy.add({ group: 'edges', data: edgeInfo.data, classes: 'updated-node' });
                    changesMade = true;
                } else {
                    console.warn(`Skipping edge ${edgeInfo.data.id}: source or target node not found after initial add.`);
                }
            }
        }
    });

    // 3. Process Indicators for each village
    villageDataMap.forEach((stats, villageName) => {
        const villageIdCurrent = `village_${villageName}_${currentTimeTag}`;
        const villageNode = cy.getElementById(villageIdCurrent);

        if (!villageNode.length) {
            console.warn(`村庄节点 ${villageIdCurrent} 未在图谱中找到，无法更新指标。`);
            return;
        }

        // Calculate 'modify' area changes
        // This requires finding the *previous* version of modified plots in the graph
        stats.original_features.forEach(featureProps => {
            if (featureProps.changetype === 'modify') {
                const TBBH = String(featureProps.TBBH);
                const featureIdBase = featureProps.BSM || featureProps.OBJECTID || TBBH;
                const plotIdPrevious = `plot_${featureIdBase}_${PREVIOUS_TIME_TAG}`;
                const oldPlotNode = cy.getElementById(plotIdPrevious);
                if (oldPlotNode.length) {
                    const oldArea = parseFloat(oldPlotNode.data('地块面积') || 0);
                    const newArea = parseFloat(featureProps.Shape_Area || featureProps.TBMJ || 0);
                    const delta = newArea - oldArea;
                    if (delta > 0) stats.modify_inc_area += delta;
                    else stats.modify_dec_area += Math.abs(delta);

                    // Example: Track changes in ZZSXMC for modify for crop_area_change / uncultivated_change
                    const oldZzsxmc = oldPlotNode.data('种植状态');
                    const newZzsxmc = featureProps.ZZSXMC;

                    // Area removed from oldZzsxmc
                    if (oldZzsxmc === '种植粮食作物') stats.crop_area_change -= oldArea;
                    else if (oldZzsxmc === '未耕种') stats.uncultivated_change -= oldArea;
                    // Area added to newZzsxmc
                    if (newZzsxmc === '种植粮食作物') stats.crop_area_change += newArea;
                    else if (newZzsxmc === '未耕种') stats.uncultivated_change += newArea;

                } else {
                     console.warn(`修改地块 ${TBBH} 的历史版本 ${plotIdPrevious} 未找到，面积变更无法精确计算。`);
                     // Fallback: treat modify as create if old not found, or use a default change.
                     // For simplicity, we'll assume area change is just the newArea if old not found (less accurate).
                     // stats.modify_inc_area += parseFloat(featureProps.Shape_Area || featureProps.TBMJ || 0);
                }
            }
        });


        // Indicator calculation logic (mirrors Python script)
        const indicatorsToUpdate = []; // [{ name, value }]

        // --- 耕地总面积 & 耕地地块数量 ---
        const prev_total_area = getPreviousIndicatorValue(cy, villageName, '耕地总面积', PREVIOUS_TIME_TAG);
        const prev_plot_count = getPreviousIndicatorValue(cy, villageName, '耕地地块数量', PREVIOUS_TIME_TAG);

        const current_total_area = Math.max(0, prev_total_area + stats.create_area - stats.delete_area + stats.modify_inc_area - stats.modify_dec_area);
        const current_plot_count = Math.max(1, prev_plot_count + stats.create_count - stats.delete_count);
        indicatorsToUpdate.push({ name: '耕地总面积', value: current_total_area.toFixed(4) });
        indicatorsToUpdate.push({ name: '耕地地块数量', value: current_plot_count });

        // --- 新增耕地面积 ---
        const current_created_area_total = (stats.create_area + stats.modify_inc_area).toFixed(4);
        indicatorsToUpdate.push({ name: '新增耕地面积', value: current_created_area_total });

        // --- 耕地流出面积 ---
        const current_deleted_area_total = (stats.delete_area + stats.modify_dec_area).toFixed(4);
        indicatorsToUpdate.push({ name: '耕地流出面积', value: current_deleted_area_total });
        
        // --- 耕地破碎度 ---
        const current_fragmentation = current_total_area > 0 && current_plot_count > 0 ? (current_total_area / current_plot_count).toFixed(4) : 0;
        indicatorsToUpdate.push({ name: '耕地破碎度', value: current_fragmentation });

        // --- 耕地流转率 ---
        const current_turnover_rate = current_total_area > 0 ? ((parseFloat(current_created_area_total) + parseFloat(current_deleted_area_total)) / current_total_area).toFixed(4) : 0;
        indicatorsToUpdate.push({ name: '耕地流转率', value: current_turnover_rate });

        // --- 非粮化面积 ---
        // Python: prev_non_grain + (stats['create_area'] - stats['crop_area']) -- this formula seems a bit off.
        // crop_area was calculated as net change.
        // Let's use: prev_non_grain + (total area change for non-grain crops)
        // For simplicity, let's assume change in non-grain area is (create_area + modify_inc_area) - (change in crop_area based on ZZSXMC)
        // A more direct Python equivalent might be: prev_non_grain + (create_area_actually_non_grain - delete_area_actually_non_grain + modify_change_to_non_grain)
        // Using stats.crop_area_change which is net change for '种植粮食作物'
        const prev_non_grain_area = getPreviousIndicatorValue(cy, villageName, '非粮化面积', PREVIOUS_TIME_TAG);
        // Change in total area - change in grain crop area = change in non-grain area
        const total_area_delta = current_total_area - prev_total_area;
        const current_non_grain_area = Math.max(0, prev_non_grain_area + (total_area_delta - stats.crop_area_change)).toFixed(4);
        indicatorsToUpdate.push({ name: '非粮化面积', value: current_non_grain_area });

        // --- 非粮化比例 ---
        const current_non_grain_rate = current_total_area > 0 ? (parseFloat(current_non_grain_area) / current_total_area).toFixed(4) : 0;
        indicatorsToUpdate.push({ name: '非粮化比例', value: current_non_grain_rate });

        // --- 耕种面积 & 土地垦殖率 (related to '未耕种') ---
        const prev_cultivated_area = getPreviousIndicatorValue(cy, villageName, '耕种面积', PREVIOUS_TIME_TAG);
        // current_cultivated_area = prev_cultivated_area + total_area_delta - stats.uncultivated_change;
        // OR simpler: current_total_area - (current total uncultivated area)
        // We need total uncultivated area. stats.uncultivated_change is just the delta.
        // Let prev_uncultivated_area = prev_total_area - prev_cultivated_area;
        // current_total_uncultivated = prev_uncultivated_area + stats.uncultivated_change
        const current_total_uncultivated_area = (prev_total_area - prev_cultivated_area) + stats.uncultivated_change;
        const current_cultivated_area = Math.max(0, current_total_area - current_total_uncultivated_area).toFixed(4);
        indicatorsToUpdate.push({ name: '耕种面积', value: current_cultivated_area });
        
        const current_cultivation_rate = current_total_area > 0 ? (parseFloat(current_cultivated_area) / current_total_area).toFixed(4) : 0;
        indicatorsToUpdate.push({ name: '土地垦殖率', value: current_cultivation_rate }); // Python calls it '土地垦殖率'

        // --- 耕种指数 (Python: stats['uncultivated'] / current_total) - This seems like 'uncultivated rate'
        // Python's name might be misleading or formula different. Let's assume it's uncultivated rate.
        const current_uncultivated_rate = current_total_area > 0 ? (current_total_uncultivated_area / current_total_area).toFixed(4) : 0;
        indicatorsToUpdate.push({ name: '耕地撂荒率', value: current_uncultivated_rate }); // More descriptive name based on formula


        // Add/Update Indicator Nodes and their relationships
        indicatorsToUpdate.forEach(ind => {
            const indicatorIdCurrent = `indicator_${villageName}_${ind.name}_${currentTimeTag}`;
            const indicatorIdPrevious = `indicator_${villageName}_${ind.name}_${PREVIOUS_TIME_TAG}`;
            let indicatorNodeCurrent = cy.getElementById(indicatorIdCurrent);

            if (!indicatorNodeCurrent.length) {
                cy.add({
                    group: 'nodes',
                    data: {
                        id: indicatorIdCurrent,
                        name: `${villageName}-${ind.name}`,
                        指标名称: ind.name,
                        指标值: ind.value,
                        权属单位: villageName,
                        更新时间: currentTimeTag,
                        type: '指标',
                        labels: ['指标'],
                        color: getColorForLabelsCached(['指标'])
                    },
                    classes: 'updated-node'
                });
                indicatorNodeCurrent = cy.getElementById(indicatorIdCurrent); // Re-fetch after adding
                changesMade = true;

                // "包含" Relationship (村 -> 指标)
                cy.add({
                    group: 'edges',
                    data: {
                        id: `relcon_${villageIdCurrent}_to_${indicatorIdCurrent}`,
                        source: villageIdCurrent,
                        target: indicatorIdCurrent,
                        label: '包含',
                        type: '包含关系'
                    },
                    classes: 'updated-node'
                });
            } else { // Indicator node for current time already exists, just update value
                indicatorNodeCurrent.data('指标值', ind.value);
                changesMade = true; // Value changed
            }

            // "继承" Relationship (新指标 -> 旧指标)
            const indicatorNodePrevious = cy.getElementById(indicatorIdPrevious);
            if (indicatorNodePrevious.length) {
                const inheritEdgeId = `relin_${indicatorIdCurrent}_from_${indicatorIdPrevious}`;
                if (!cy.getElementById(inheritEdgeId).length) {
                     cy.add({
                        group: 'edges',
                        data: {
                            id: inheritEdgeId,
                            source: indicatorIdCurrent,
                            target: indicatorIdPrevious,
                            label: '继承',
                            type: '继承关系'
                        },
                        classes: 'updated-node'
                    });
                }
            }
        });
    });


    if (changesMade) {
        updateStatus.value = "前端图谱更新正在应用布局...";
        console.log("Changes made, running layout for updated graph (GeoJSON/File Update).");
        cy.layout({
            name: 'fcose',
            animate: true, fit: true, padding: 50, randomize: true,
            nodeRepulsion: 10000, idealEdgeLength: 70, avoidOverlap: true,
        }).run();

        nodeCount.value = cy.nodes().length;
        edgeCount.value = cy.edges().length;


        const legendMap = {};
        cy.nodes().forEach(node => {
            const primaryLabel = node.data('type') || (node.data('labels') && node.data('labels').length ? node.data('labels')[0] : '其他');
            if (!legendMap[primaryLabel]) {
                legendMap[primaryLabel] = { label: primaryLabel, count: 0, color: node.style('background-color') };
            }
            legendMap[primaryLabel].count++;
        });
        legendData.value = Object.values(legendMap);
        updateStatus.value = `前端图谱更新已应用并重排布局。节点: ${nodeCount.value}, 关系: ${edgeCount.value}`;
    } else {
        updateStatus.value = "未检测到有效的新增或变更来应用到图谱。";
    }
    
    // Reset file inputs (as in original code)
    uploadedJsonFile.value = null; selectedJsonFileName.value = '';
    uploadedGeoJsonFile.value = null; selectedGeoJsonFileName.value = '';
    fileDataForCytoscape.value = null;
    const jsonInput = document.getElementById('jsonFileUploadInput');
    if(jsonInput) jsonInput.value = '';
    const geoJsonInput = document.getElementById('geoJsonFileUploadInput');
    if(geoJsonInput) geoJsonInput.value = '';
};

// Placeholder for Large Language Model integration
const useLargeModel = async () => { // Make it async for await
    if (!largeModelApiKey.value) {
        updateStatus.value = "请输入大模型API密钥。";
        return;
    }

    if (!selectedNode.value) {
        updateStatus.value = "请先选择一个节点进行分析。";
        return;
    }

    updateStatus.value = "正在准备大模型请求...";
    console.log("大模型API密钥:", largeModelApiKey.value);
    
    // 1. Prepare data for the prompt
    //    The Python script expects 'current_feature' and optionally 'historical'.
    //    We'll assume `selectedNode.value` is our `current_feature`.
    //    For 'historical', the Python script uses `historical['Area']`.
    //    We need to decide how to get historical data. For this example,
    //    let's assume `selectedNode.value` might have a `last_area` property,
    //    or we pass null/undefined if not available.

    const currentFeature = selectedNode.value; // Expects: TBBH, changetype, Area, DLMC, district
    
    // Let's assume historical data for 'last_area' might be on the current feature,
    // or you might fetch it separately. For simplicity, let's check for a `last_area` prop.
    // If your historical data is structured differently (e.g., an array of past states),
    // you'd need to adapt this.
    const historicalData = {
        Area: currentFeature.last_area // Or some other way to get historical area
    };

    // 2. Replicate generate_prompt logic
    const generatePromptJS = (current, historical = null) => {
        const context = {
            TBBH: current.TBBH || '未知', // Provide defaults if properties might be missing
            changetype: current.changetype || '未知',
            Area: current.Shape_Area || '未知',
            DLMC: current.DLMC || '未知',
            district: current.ZLDWMC || '未知',
            last_area: (historical && historical.Area !== undefined) ? historical.Area : '无历史数据' // Handle if historical or its Area is null/undefined
        };
        
        // This is the exact prompt template from your Python script
        return `作为耕地数据质检专家，请分析以下变更记录：
                地块编号：${context.TBBH}
                变更类型：${context.changetype}
                面积：${context.Area}亩
                地类：${context.DLMC}
                行政区：${context.district}
                历史面积：${context.last_area}${context.last_area !== '无历史数据' ? '亩' : ''}
                请判断是否存在矛盾并输出JSON：
                {{
                "矛盾类型": ["数值冲突","逻辑矛盾","政策违规"],
                "矛盾描述": "自然语言解释",
                "置信度": 0.0-1.0,
                "建议操作": ["修正面积","变更类型","标记异常"],
                "修正值": 具体数值,
                "依据条款": ["《耕地保护法》第X条"]
                }}`;
                    };

    const promptContent = generatePromptJS(currentFeature, historicalData.Area !== undefined ? historicalData : null);
    console.log("Generated Prompt for LLM:", promptContent);
    updateStatus.value = `正在调用大模型分析节点 "${currentFeature.TBBH || currentFeature.name || currentFeature.id}"...`;

    // 3. Call the OpenAI API (or compatible API)
    try {
        // const model = genAI.getGenerativeModel({
        //     model: "gemini-2.0-flash", // Or "gemini-pro", or "gemini-2.0-flash" if it exists
        //     generationConfig: {
        //         temperature: 0.2,
        //         responseMimeType: "application/json", // Crucial for getting JSON output directly
        //     }
        // });

        const result = await genAI.models.generateContent({model: "gemini-2.0-flash",contents:promptContent});
        console.log("Full result from model.generateContent:", JSON.stringify(result, null, 2)); // 打印完整的 result 对象
        const genAIResponse = result.candidates[0].content.parts[0].text; // Access the GenerateContentResponse

        if (!genAIResponse) {
            throw new Error("Google GenAI API did not return a response object.");
        }

        const llmResponseText = genAIResponse; // Get the text content (should be JSON string)

        if (!llmResponseText) {
            throw new Error("大模型未返回有效内容。");
        }

        console.log("Raw LLM Response (should be JSON string):", llmResponseText);

        // 4. Parse the JSON response from the LLM
        // LLMs might sometimes wrap JSON in markdown code blocks (```json ... ```)
        let validationResult;
        try {
            const jsonMatch = llmResponseText.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch && jsonMatch[1]) {
                console.log("Found JSON in markdown, parsing that.");
                validationResult = JSON.parse(jsonMatch[1]);
            } else {
                validationResult = JSON.parse(llmResponseText); // Assume raw JSON
            }
        } catch (parseError) {
            console.error("Failed to parse LLM JSON response:", parseError);
            updateStatus.value = `大模型分析完成，但无法解析其JSON响应。内容: ${llmResponseText.substring(0, 200)}...`;
            // Optionally, store the raw response for debugging
            // if (selectedNode && selectedNode.value) selectedNode.value.llmRawResponse = llmResponseText;
            return; // Stop further processing
        }
        

        console.log("Parsed Validation Result:", validationResult);

        // Update status and potentially store the result on the node or elsewhere
        updateStatus.value = `大模型分析节点 "${currentFeature.TBBH || currentFeature.name || currentFeature.id}" 完成。
        矛盾描述: ${validationResult["矛盾描述"] || '无'} (置信度: ${validationResult["置信度"] !== undefined ? validationResult["置信度"] : 'N/A'})`;
        
        // You might want to attach the result to the selectedNode or handle it further
        // For example:
        // selectedNode.value.validation = validationResult;

    } catch (error) {
        console.error("Error calling Google GenAI API:", error);
        let errorMessage = error.message || String(error);
        // Google API errors might have more details in error.response or other properties
        if (error.toString().includes("API key not valid")) {
            errorMessage = "Google API Key is not valid. Please check your API key.";
        } else if (error.status && error.statusText) { // Some HTTP-like errors
            errorMessage = `API Error ${error.status}: ${error.statusText}`;
        }
        // For GenAI specific errors, they might have a different structure.
        // Often, the error object itself contains useful `message` and `details`.
        console.error("Detailed error object:", error);
        updateStatus.value = `调用 Google GenAI API 失败: ${errorMessage}`;
    }
};
const togglePinPanel = () => {
  infoPanelPinState.value = !infoPanelPinState.value;
  // If unpinning, and mouse is not over, it should hide
  if (!infoPanelPinState.value && !isMouseOverPanel.value) { // (isMouseOverPanel would be a new ref to track this precisely)
      isInfoPanelVisible.value = false; // For now, simpler: just unpinning means it can hide on mouseleave
  } else if (infoPanelPinState.value) {
      isInfoPanelVisible.value = true; // Ensure it's visible when pinned
  }
};
</script>

<style scoped>
/* Overall container for the editor */
.knowledge-graph-editor-container {
  display: flex;
  flex-direction: row;
  height: 100vh; /* Full viewport height */
  width: 100vw;  /* Full viewport width */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f4f7f9;
  box-sizing: border-box;
  overflow: hidden; /* Prevent scrollbars on the main container */
}

/* Left panel for file operations and controls */
.file-operations-panel {
  width: 380px; /* Slightly reduced width */
  min-width: 360px; /* Slightly reduced min-width */
  padding: 15px; /* Reduced padding */
  border-right: 1px solid #dde3ea;
  background-color: #ffffff;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.03); /* Softer shadow */
  overflow-y: auto; /* Allow scrolling ONLY if content overflows */
  display: flex;
  flex-direction: column;
  gap: 12px; /* Reduced gap between sections */
}

/* Individual sections within the left panel */
.panel-section {
  padding: 12px; /* Reduced padding */
  border-radius: 6px; /* Slightly smaller radius */
  background-color: #fdfdff; /* Slightly lighter background */
  border: 1px solid #e0e4e8; /* Lighter border */
}

/* Titles for panel sections */
.panel-title {
  margin-top: 0;
  margin-bottom: 8px; /* Reduced margin */
  color: #1a232f; /* Darker, more saturated title color */
  font-size: 1.15em; /* Reduced font size */
  font-weight: 600;
  padding-bottom: 8px; /* Reduced padding */
  border-bottom: 2px solid #3b82f6; /* Keep accent border */
}

/* Subtitles within panel sections */
.panel-subtitle {
  margin-top: 0;
  margin-bottom: 6px; /* Reduced margin */
  color: #303946; /* Slightly darker subtitle */
  font-size: 0.95em; /* Reduced font size */
  font-weight: 500;
}

/* Descriptive text in panels */
.panel-description {
  font-size: 0.8em; /* Reduced font size */
  color: #606a77; /* Slightly darker description text */
  margin-bottom: 10px; /* Reduced margin */
  line-height: 1.4;
}

/* Cypher query input textarea */
.cypher-input {
  width: 100%;
  padding: 8px; /* Reduced padding */
  border: 1px solid #c5cdd6; /* Slightly darker border */
  border-radius: 5px; /* Slightly smaller radius */
  font-size: 0.8em; /* Reduced font size */
  box-sizing: border-box;
  margin-bottom: 8px; /* Reduced margin */
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  resize: vertical; /* Allow vertical resize */
}

/* Grouping for file input elements */
.file-input-group {
    margin-bottom: 8px; /* Reduced margin */
}

/* Custom styled label for file inputs */
.file-input-group .file-input-label.small-label {
    font-size: 0.8em; /* Reduced font size */
    padding: 6px 10px; /* Reduced padding */
    background-color: #f0f6ff; /* Lighter blue */
    color: #0277bd; /* Darker blue text */
    border: 1px solid #baddfd;
    display: block;
    margin-bottom: 4px; /* Reduced margin */
    cursor: pointer;
    border-radius: 5px;
    transition: background-color 0.2s;
}
.file-input-group .file-input-label.small-label:hover {
    background-color: #e0effe;
}

/* Hide default file input */
.file-input { display: none; }

/* Display for selected file name */
.selected-file-name {
  font-size: 0.75em; /* Reduced font size */
  color: #454f5b;
  background-color: #eef1f4; /* Lighter background */
  padding: 5px 8px; /* Reduced padding */
  border-radius: 4px;
  border: 1px solid #cdd3da;
  display: inline-block;
  margin-top: 4px; /* Reduced margin */
  max-width: calc(100% - 18px); /* Ensure it fits */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* General text input fields */
.text-input {
  width: 100%;
  padding: 8px 10px; /* Reduced padding */
  border: 1px solid #c5cdd6;
  border-radius: 5px;
  font-size: 0.85em; /* Reduced font size */
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
  margin-bottom: 10px; /* Reduced margin */
}
.text-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15); /* Softer focus shadow */
  outline: none;
}

/* Action buttons */
.action-button {
  background-color: #3b82f6; /* Primary blue */
  color: white;
  border: none;
  padding: 8px 15px; /* Reduced padding */
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.9em; /* Reduced font size */
  font-weight: 500;
  transition: background-color 0.2s ease-in-out, transform 0.1s;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 8px; /* Consistent margin */
}
.action-button:hover:not(:disabled) {
  background-color: #2563eb; /* Darker blue on hover */
  transform: translateY(-1px);
}
.action-button:disabled {
  background-color: #9ca3af; /* Muted gray for disabled */
  cursor: not-allowed;
}

/* Specific styling for load button */
.action-button.load-button { background-color: #10b981; /* Green */ }
.action-button.load-button:hover:not(:disabled) { background-color: #059669; /* Darker green */ }

/* Specific styling for secondary buttons */
.action-button.secondary-button { background-color: #6b7280; /* Gray */ }
.action-button.secondary-button:hover:not(:disabled) { background-color: #4b5563; /* Darker gray */ }


/* Container for file preview */
.file-preview-container {
  margin-top: 8px; /* Reduced margin */
  background-color: #f8f9fa;
  border: 1px solid #e0e4e8;
  border-radius: 5px;
  padding: 10px; /* Reduced padding */
}
.preview-title {
  margin-top: 0;
  margin-bottom: 6px; /* Reduced margin */
  font-size: 0.9em; /* Reduced font size */
  color: #1a232f;
  font-weight: 500;
}
/* Content area for file preview (scrollable) */
.file-preview-content {
  background-color: #ffffff;
  padding: 8px; /* Reduced padding */
  border-radius: 4px;
  font-size: 0.7em; /* Reduced font size for dense preview */
  max-height: 120px; /* Reduced max height */
  overflow-y: auto;
  word-break: break-all;
  border: 1px solid #d1d5db;
  color: #374151;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
}

/* Status messages */
.update-status-message {
  margin-top: 8px; /* Reduced margin */
  padding: 10px; /* Reduced padding */
  border-radius: 5px;
  font-size: 0.85em; /* Reduced font size */
  background-color: #eef6ff; /* Lighter blue */
  border: 1px solid #bedcfe; /* Light blue border */
  color: #1d4ed8; /* Darker blue text */
  line-height: 1.45;
}

/* Right panel for knowledge graph display */
.knowledge-graph-panel {
  flex-grow: 1;
  position: relative;
  background-color: #e9eef2; /* Slightly muted background */
}
/* Cytoscape container view */
.cytoscape-graph-view {
  width: 100%;
  height: 100%;
  display: block;
}

/* Statistics display for graph (node/edge counts) */
.graph-stats p {
    margin: 4px 0; /* Reduced margin */
    font-size: 0.85em; /* Reduced font size */
    color: #4a5563;
}
/* Legend container */
.legend-container { margin-top: 10px; /* Reduced margin */ }
.legend-container h4 {
  font-size: 0.95em; /* Reduced font size */
  margin-bottom: 4px; /* Reduced margin */
  color: #303946;
}
.legend-container ul { list-style: none; padding-left: 0; margin:0; }
.legend-container li {
  display: flex;
  align-items: center;
  margin-bottom: 3px; /* Reduced margin */
  font-size: 0.8em; /* Reduced font size */
  color: #4a5563;
}
/* Color box in legend */
.legend-color-box {
  width: 12px; /* Smaller box */
  height: 12px; /* Smaller box */
  border-radius: 3px;
  margin-right: 6px; /* Reduced margin */
  border: 1px solid #c0c0c0; /* Lighter border */
}

/* Placeholder for map modal */
.map-modal-placeholder {
    background-color: white;
    border:1px solid #ccc;
    padding: 12px; /* Reduced padding */
    margin-top:8px; /* Reduced margin */
    border-radius: 5px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08); /* Softer shadow */
    text-align: center;
    font-size: 0.9em;
}
.map-modal-placeholder button {
    margin-left: 10px;
    padding: 4px 8px;
    font-size: 0.85em;
    background-color: #e7e7e7;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
}
.map-modal-placeholder button:hover {
    background-color: #dcdcdc;
}


/* Loading overlay styles */
.loading-overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(255, 255, 255, 0.8); /* Slightly less opaque */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10000; /* Ensure it's on top */
}
.spinner {
    border: 5px solid #e0e7ff; /* Lighter base color */
    border-top: 5px solid #3b82f6; /* Primary blue for spinner arm */
    border-radius: 50%;
    width: 45px; /* Slightly smaller */
    height: 45px; /* Slightly smaller */
    animation: spin 0.7s linear infinite; /* Faster spin */
    margin-bottom: 12px; /* Reduced margin */
}
.loading-overlay p {
    font-size: 1.05em; /* Slightly smaller text */
    color: #1a232f;
    font-weight: 500;
}

/* Keyframes for spinner animation */
@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
</style>
