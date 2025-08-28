<template>
  <!-- 加载中动画 -->
  <div v-if="loading" class="loading-container">
    <Spin tip="加载中..." />
  </div>

  <!-- 图表容器 -->
  <div v-show="!loading" ref="chartRef" class="chart-box"></div>

  <!-- 添加一个侧边栏用于显示节点/边的详细信息 -->
  <Drawer :visible="!!selectedElement" :title="drawerTitle" @close="selectedElement = null" :width="400">
    <pre v-if="selectedElement?.properties">{{ JSON.stringify(selectedElement.properties, null, 2) }}</pre>
  </Drawer>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed,nextTick } from 'vue';
import { Spin, message, Drawer } from 'ant-design-vue';
import { Network } from 'vis-network/standalone/esm/vis-network.min.js';
import 'vis-network/styles/vis-network.css';
import { getFullGraphFromNeo4j } from './rag'; // 需要在 rag.ts 中创建这个新函数
import type { GraphData } from './rag';


const props = defineProps<{
  // 接收一个可选的“数据加载函数” prop
  graphDataLoader?: () => Promise<GraphData>; 
}>();
const loading = ref(true);
const chartRef = ref<HTMLElement | null>(null);
let networkInstance: Network | null = null;

// 用于详情展示
const selectedElement = ref<any>(null);
const drawerTitle = computed(() => selectedElement.value?.type === 'node' ? '节点详情' : '关系详情');


const initNetwork = async () => {
    if (networkInstance || !chartRef.value) return;
    loading.value = true;
    try {
        const loader = props.graphDataLoader || (() => getFullGraphFromNeo4j(200));
        const graphData: GraphData = await loader();

        const nodes = graphData.nodes.map(n => ({
            id: `node-${n.id}`,
            label: n.label,
            title: `类型: ${n.type}`, // 鼠标悬浮提示
            group: n.type,
            properties: n.properties,
            type: 'node'
        }));
        const seenEdgeIds = new Set();
        const uniqueEdges = graphData.edges.filter(edge => {
          if (seenEdgeIds.has(edge.id)) {
            return false;
          }else {
            seenEdgeIds.add(edge.id);
            return true;
          }

        });
        const edges = uniqueEdges.map(e => ({
            id: `edge-${e.id}`,
            from: `node-${e.source}`,
            to: `node-${e.target}`,
            label: e.label, // 在边上显示关系名称
            arrows: 'to',
            properties: e.properties,
            type: 'edge'
        }));

        const data = { nodes, edges };
        const options = {
            nodes: { shape: 'dot', size: 20 },
            edges: { font: { align: 'top' } },
            physics: { stabilization: false },
            interaction: { hover: true },
        };

        networkInstance = new Network(chartRef.value, data, options);
        
        // 添加点击事件
        networkInstance.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                selectedElement.value = nodes.find(n => n.id === nodeId);
            } else if (params.edges.length > 0) {
                const edgeId = params.edges[0];
                selectedElement.value = edges.find(e => e.id === edgeId); // vis-network 的 edge id 是自动生成的
            } else {
                selectedElement.value = null;
            }
        });

    } catch(e) {console.error("加载图谱失败:", e); 
        const errorMessage = e instanceof Error ? e.message : String(e);
        message.error(`加载图谱失败: ${errorMessage}`);}
    finally { loading.value = false; }
};

// watch(() => props.visible, (isVisible) => {
//     if (isVisible) {
//       setTimeout(initNetwork, 300);
//     }
// });

onMounted(() => {
  nextTick(initNetwork);   // 组件一挂载就初始化
});

onUnmounted(() => { networkInstance?.destroy(); });
</script>

<style scoped>
.chart-box {
  width: 100%;
  height: 60vh;
  min-height: 400px;
}
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60vh;
}
</style>