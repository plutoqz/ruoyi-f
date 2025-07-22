<template>
  <div class="visualization-panel">
    <!-- Panel Header with Fullscreen Button -->
    <div class="panel-header">
      <h2>知识图谱可视化</h2>
      <button @click="isFullScreen = true" class="fullscreen-btn" title="全屏查看" v-if="hasGraphData">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      </button>
    </div>

    <!-- Default Graph Container -->
    <div class="graph-container">
      <div ref="cyContainer" class="cy-container"></div>
      <div v-if="isGenerating" class="overlay loading-indicator">
        <div class="spinner"></div>
        <p>正在生成知识图谱...</p>
      </div>
      <div v-else-if="!hasGraphData" class="overlay empty-graph">
        <i class="graph-icon">🌐</i>
        <p>知识图谱将在这里展示</p>
        <p>请先在左侧定义节点和关系，然后点击 "生成知识图谱"</p>
      </div>
    </div>
  </div>

  <!-- Fullscreen Modal -->
  <div v-if="isFullScreen" class="fullscreen-modal">
    <div class="fullscreen-header">
        <h3>知识图谱 - 全屏模式</h3>
        <button @click="isFullScreen = false" class="close-btn" title="关闭全屏">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
    </div>
    <div ref="cyFullScreenContainer" class="cy-container-fullscreen"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed, defineProps, nextTick } from 'vue';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';

cytoscape.use(fcose);

const props = defineProps({
  graphData: {
    type: Object,
    required: true
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
});

//颜色映射
const COLOR_PALETTE = [
  '#5B8FF9', // 鲜艳的蓝色
  '#9270CA', // 温和的紫色
  '#61DDAA', // 青绿色
  '#F6BD16', // 金黄色
  '#E8684A', // 珊瑚橙
  '#748EBC', // 灰蓝色
  '#FF9D4D', // 亮橙色
  '#269A99', // 深青色
  '#d62728', // 红色
  '#8c564b', // 棕色
  '#e377c2', // 粉色
  '#7f7f7f'  // 中灰色
];


// --- Refs and State ---
const cyContainer = ref(null);
const cyFullScreenContainer = ref(null); // Ref for the fullscreen container
let cyInstance = null;
const isFullScreen = ref(false); // State to control fullscreen mode

const hasGraphData = computed(() => props.graphData && props.graphData.nodes.length > 0);

/**
 * 优先从预定义的 COLOR_PALETTE 中按顺序获取颜色。
 * 如果颜色表用尽，则自动回退到哈希生成方法。
 * @param {string} type - 节点类型。
 * @param {Map} colorMap - 用于缓存类型与颜色映射的Map对象。
 * @returns {string} 颜色代码。
 */

const getColorForType = (type, colorMap) => {
  // 如果此类型已经分配过颜色，直接返回缓存的颜色
  if (colorMap.has(type)) {
    return colorMap.get(type);
  }

  // 确定下一个要分配的颜色
  let newColor;
  const nextColorIndex = colorMap.size; // 获取当前已分配颜色的数量

  // 如果颜色表里还有未使用的颜色，则从中取一个
  if (nextColorIndex < COLOR_PALETTE.length) {
    newColor = COLOR_PALETTE[nextColorIndex];
  } else {
    // 否则（颜色表已用尽），回退到哈希生成方法来创造一个新颜色
    console.warn(`颜色表已用尽，为类型 "${type}" 动态生成颜色。`);
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
      hash = type.charCodeAt(i) + ((hash << 5) - hash);
      hash |= 0;
    }
    const hue = Math.abs(hash % 360);
    const saturation = 60 + Math.abs((hash >> 8) % 31);
    const lightness = 60 + Math.abs((hash >> 16) % 21); // 提高亮度下限，避免太暗
    newColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  // 将新分配的颜色存入缓存，并返回
  colorMap.set(type, newColor);
  return newColor;
};

// --- Graph Rendering ---
/**
 * Renders the knowledge graph in the currently active container.
 */
const renderGraph = () => {
  // Determine the target container based on fullscreen state
  const container = isFullScreen.value ? cyFullScreenContainer.value : cyContainer.value;

  if (!container || !props.graphData || !hasGraphData.value) return;

  // Destroy previous instance if it exists
  if (cyInstance) {
    cyInstance.destroy();
  }

  const nodeTypeColors = new Map();
  const elements = [];

  props.graphData.nodes.forEach(node => {
    elements.push({
      group: 'nodes',
      data: { id: node.id, name: node.label, color: getColorForType(node.type, nodeTypeColors) }
    });
  });
  props.graphData.edges.forEach(edge => {
    elements.push({
      group: 'edges',
      data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label }
    });
  });

  cyInstance = cytoscape({
    container: container, // Use the determined container
    elements: elements,
    // --- Restored original styles ---
    style: [
      { selector: 'node', style: { 'background-color': 'data(color)', 'label': 'data(name)', 'color': '#000', 'font-size': '10px', 'text-valign': 'center', 'text-halign': 'center', 'text-wrap': 'wrap', 'text-max-width': '80px' }},
      { selector: 'edge', style: { 'width': 1.5, 'line-color': '#ccc', 'target-arrow-color': '#ccc', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'label': 'data(label)', 'font-size': '8px', 'color': '#666' }},
      { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#333' }}
    ],
    // --- Restored original layout ---
    layout: { name: 'fcose', animate: true, nodeRepulsion: 4500, idealEdgeLength: 100, fit: true, padding: 30 }
  });
};

// --- Watchers ---

// Watch for changes in graph data and re-render
watch(() => props.graphData, (newData) => {
    if (newData && newData.nodes.length > 0) {
      renderGraph();
    } else {
      if (cyInstance) {
          cyInstance.destroy();
          cyInstance = null;
      }
    }
}, { deep: true });

// Watch for fullscreen state changes to re-render the graph in the correct container
watch(isFullScreen, () => {
    // Wait for the DOM to update (the new container to be created/destroyed)
    nextTick(() => {
        if (hasGraphData.value) {
            renderGraph();
        }
    });
});

// --- Lifecycle Hooks ---
onMounted(() => {
  if (hasGraphData.value) {
    renderGraph();
  }
});
</script>

<style scoped>
.visualization-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-right: 1rem; /* Add some padding for the button */
  flex-shrink: 0;
}

.fullscreen-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: background-color 0.2s, color 0.2s;
}

.fullscreen-btn:hover {
  background-color: #f0f0f0;
  color: #000;
}

/* Styles for the main graph container remain the same */
.graph-container {
  position: relative;
  flex-grow: 1;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #f9f9f9;
  overflow: hidden;
}

.cy-container {
  width: 100%;
  height: 100%;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  color: #666;
  background-color: rgba(255, 255, 255, 0.8);
}

.loading-indicator .spinner {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-graph .graph-icon {
  font-size: 48px;
  color: #ccc;
  margin-bottom: 1rem;
}

.empty-graph p {
  margin: 0.25rem 0;
}

/* --- Fullscreen Modal Styles --- */
.fullscreen-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #fff;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  padding: 20px;
  box-sizing: border-box;
}

.fullscreen-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  flex-shrink: 0;
}

.fullscreen-header h3 {
    margin: 0;
    font-size: 1.2rem;
    color: #333;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px;
  border-radius: 50%;
  color: #888;
  transition: background-color 0.2s, color 0.2s;
}

.close-btn:hover {
  background-color: #f0f0f0;
  color: #000;
}

.cy-container-fullscreen {
  width: 100%;
  height: 100%;
  flex-grow: 1;
  border: 1px solid #ccc;
  border-radius: 8px;
}
</style>