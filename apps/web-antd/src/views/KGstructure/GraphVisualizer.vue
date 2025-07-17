<template>
  <div class="visualization-panel">
    <h2>知识图谱可视化</h2>
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
</template>

<script setup>
import { ref, watch, onMounted, computed, defineProps } from 'vue';
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

const cyContainer = ref(null);
let cyInstance = null;

const hasGraphData = computed(() => props.graphData && props.graphData.nodes.length > 0);

const nodeColorPalette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA', '#F0B7A4', '#F6EFA6'];
const nodeTypeColors = new Map();
let colorIndex = 0;

const getColorForType = (type) => {
  if (!nodeTypeColors.has(type)) {
    nodeTypeColors.set(type, nodeColorPalette[colorIndex % nodeColorPalette.length]);
    colorIndex++;
  }
  return nodeTypeColors.get(type);
};

const renderGraph = () => {
  if (!cyContainer.value || !props.graphData) return;
  if (cyInstance) {
    cyInstance.destroy();
  }

  const elements = [];
  props.graphData.nodes.forEach(node => {
    elements.push({
      group: 'nodes',
      data: { id: node.id, name: node.label, color: getColorForType(node.type) }
    });
  });
  props.graphData.edges.forEach(edge => {
    elements.push({
      group: 'edges',
      data: { id: edge.id, source: edge.source, target: edge.target, label: edge.label }
    });
  });

  cyInstance = cytoscape({
    container: cyContainer.value,
    elements: elements,
    style: [
      { selector: 'node', style: { 'background-color': 'data(color)', 'label': 'data(name)', 'color': '#000', 'font-size': '10px', 'text-valign': 'center', 'text-halign': 'center', 'text-wrap': 'wrap', 'text-max-width': '80px' }},
      { selector: 'edge', style: { 'width': 1.5, 'line-color': '#ccc', 'target-arrow-color': '#ccc', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'label': 'data(label)', 'font-size': '8px', 'color': '#666' }},
      { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#333' }}
    ],
    layout: { name: 'fcose', animate: true, nodeRepulsion: 4500, idealEdgeLength: 100, fit: true, padding: 30 }
  });
};

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

onMounted(() => {
  if (hasGraphData.value) {
    renderGraph();
  }
});
</script>

<style scoped>
/* Scoped styles can be added here if needed */
</style>