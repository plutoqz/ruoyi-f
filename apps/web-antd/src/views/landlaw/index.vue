<template>
  <div id="kg-container">
    <div class="flex flex-col h-screen p-4 space-y-4 font-inter">

      <div class="flex flex-1 space-x-4 overflow-hidden">
        <div class="w-64 bg-gray-50 border border-gray-200 rounded-lg flex flex-col shadow-sm">
          <div class="p-4 border-t border-gray-200 flex-1 overflow-y-auto">
            <h3 class="text-md font-semibold text-gray-700 mb-3">图谱数据统计</h3>
            <div class="space-y-2">
              <div class="flex justify-between items-center bg-white p-2 rounded-md border border-gray-100">
                <span class="text-sm text-gray-600">节点数量</span>
                <span class="font-bold text-blue-600 text-sm">{{ nodeCount }}</span>
              </div>
              <div class="flex justify-between items-center bg-white p-2 rounded-md border border-gray-100">
                <span class="text-sm text-gray-600">关系数量</span>
                <span class="font-bold text-blue-600 text-sm">{{ edgeCount }}</span>
              </div>
            </div>
            <div class="space-y-2">
              <h3 class="text-md font-semibold text-gray-700 mb-2 pt-2 border-t border-gray-200">节点图例</h3>
                <div v-if="legendData.length > 0" class="space-y-1.5">
                  <div v-for="item in legendData" :key="item.label" class="flex items-center justify-between text-xs">
                    <div class="flex items-center space-x-1.5">
                       <span class="inline-block w-3 h-3 rounded-sm border border-gray-300" :style="{ backgroundColor: item.color }"></span>
                       <span class="text-gray-700">{{ item.label[0] }}</span>
                    </div>
                    <span class="font-medium text-gray-600 bg-gray-100 px-1 rounded">{{ item.count }}</span>
                  </div>
                </div>
                <div v-else class="text-xs text-gray-500 italic">
                    无可用图例数据
                </div>
            </div>
          </div>
        </div>

        <div class="flex-1 flex flex-col border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white" style="min-height: 500px">
          <div v-if="loading" class="flex items-center justify-center h-full">
            <div class="text-gray-600 animate-pulse text-lg">正在加载图数据...</div>
          </div>
          <div ref="cyContainer" class="flex-1 w-full h-full bg-gray-50"></div>
           <div v-if="error" class="flex items-center justify-center h-full text-red-600 p-4 text-center">
            加载图谱时发生错误: {{ error }}
          </div>
        </div>
      </div>
         <!-- 关系详情弹窗 -->
        <div v-if="selectededge" class="fixed bottom-4 right-4 bg-white shadow-lg rounded p-4 w-80">
          <h3 class="font-bold text-lg">关系详情</h3>
          <pre class="mt-2 text-sm text-gray-700" style="white-space: pre-wrap; word-break: break-word;">{{ selectededge.data() }}</pre>
          <button @click="closeedgeDetail" class="text-sm text-blue-500 mt-2 hover:underline">
            关闭
          </button>
        </div>
        <!-- 节点详情弹窗 -->
        <div v-if="selectedNode" class="fixed bottom-4 right-4 bg-white shadow-lg rounded p-4 w-80">
          <h3 class="font-bold text-lg">节点详情</h3>
          <pre class="mt-2 text-sm text-gray-700" style="white-space: pre-wrap; word-break: break-word;">{{ selectedNode.data() }}</pre>
          <button @click="closeNodeDetail" class="text-sm text-blue-500 mt-2 hover:underline">
            关闭
          </button>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
// import Papa from 'papaparse'
import * as Papa from 'papaparse'
import axios from 'axios'
// 注册 Cytoscape 扩展
cytoscape.use(fcose);

const cyContainer = ref(null);      // Cytoscape 容器的引用
const cy = ref(null)
const loading = ref(false);         // 控制加载状态
const error = ref(null);            // 存储错误信息

const selectedNode = ref(null);     // 选中的节点
const selectededge = ref(null);     // 选中的边

const legendData = ref([]);         // 图例数据

// 计算属性
const nodeCount = ref(0);
const edgeCount = ref(0);
//定义标签到颜色的映射
const labelColorMap = {
  "法律": "#711007",
  "章节": "#f76c5e",
  "条款": "#f68e5f",
  "土地": "#c9c19f",
  "规划": "#50c5b7",
  "制度": "#9cec5b",
  "处罚":"#000000",
  "权利":"#586ba4",
  "义务":"#324376",
  "国家机关":"#ddb771",
  "其他":"#6d3d14",
  "修订历史":"#b59da4",
  "法律主体":"#6494aa",
}
const getColorForLabels = (labels) => {
  const labelArray = Array.isArray(labels) ? labels : [labels];//获取实体类型
  
  for (const label of labelArray) {
    // 优先匹配预定义颜色
    if (labelColorMap[label]) {
      return labelColorMap[label];
    }
  }
}
// 辅助函数：根据 labels 获取节点颜色，并加入缓存
const colorCache = new Map();
const getColorForLabelsCached = (labels) => {
  const key = labels.join(","); // 多个 label 联合成一个 key
  if (colorCache.has(key)) return colorCache.get(key);
  const color = getColorForLabels(labels);  // 原有方法，假设已实现
  colorCache.set(key, color);
  return color;
};

//加载知识图谱
// 加载知识图谱
const loadGraph = async () => {
  loading.value = true;
  selectedNode.value = null;
  selectededge.value = null;
  //legendData.value = [];

  try {
    // 1. 一次性调用后端，后端根据 basePath 下的 node/edge 子文件夹返回所有记录
    const res = await axios.get('/api/read-csv-folder');
    const allRecords = res.data; // 后端直接返回 List<Object>
    const nodeItems = [];
    const edgeItems = [];
    // 2. 拆分为节点和关系两类
    allRecords.forEach(rec => {
        // 优先判断是否为边，因为边的特征更明显 (beginId 和 endId)
        // 确保这些属性不仅存在，而且是你期望的类型 (例如，非 null 的字符串)
        if (rec.type !== undefined) {
            edgeItems.push(rec);
        }
        // 否则，假设它是节点 (这基于“如果不是边，那就是节点”的假设)
        // 还可以加上对节点特有属性的检查，例如 rec.labels !== undefined
        else if (rec.labels !== undefined && Array.isArray(rec.labels)) { // 假设节点总是有 labels 数组
            nodeItems.push(rec);
        } else {
            console.warn('Unclassified record:', rec); // 记录下无法分类的项
        }
    });

    // 3. 构建可视化所需的数据结构
    const nodesMap = new Map();
    const nodes = [];
    const edges = [];

    // 3.1 节点
    nodeItems.forEach(item => {
      const id       = item.id;
      const labels   = [ item.labels ];      // 后端 NodeDto.entityType
      const name     = item.properties.name;    // 后端 NodeDto.name
      const color    = getColorForLabelsCached(labels);

      if (!nodesMap.has(id)) {
        nodesMap.set(id, true);
        nodes.push({
          data: { id, labels, name, color }
        });
      }
    });

    // 3.2 边
    edgeItems.forEach(item => {
      const beginId   = item.startNodeId;    // 后端 EdgeDto.beginId
      const endId   = item.endNodeId;      // 后端 EdgeDto.endId
      const type  = item.type; // 后端 EdgeDto.entityType
      const id   = item.id;

      // 确保端点都在 nodes 列表中
      [beginId, endId].forEach(nodeId => {
        if (!nodesMap.has(nodeId)) {
          nodesMap.set(nodeId, true);
          nodes.push({
            data: { id: nodeId, labels: [], name: '', color: '#888' }
          });
        }
      });

      // 添加这条边
      edges.push({
        data: { id: id, source: beginId, target: endId, type }
      });
    });

    // 4. 初始化或更新 Cytoscape 实例
    if (!cy.value) {
      cy.value = cytoscape({
        container: cyContainer.value,
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(name)',
              'background-color': 'data(color)',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': '8px',
              'color': '#000',
              'text-wrap': 'ellipsis',                 // 开启自动换行，防止文字过长溢出/ellipsis/wrap
              'text-max-width': '48',            // 文字最大宽度
            }
          },
          {
            selector: 'edge',
            style: {
              width: 1,
              'line-color': '#88ada6',
              'target-arrow-color': '#88ada6',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier'
            }
          },
          {
            selector: 'node:selected',
            style: { 'border-color': '#000' }
          }
        ]
      });

      cy.value.on('tap', 'node', e => {
        cy.value.elements().unselect();
        e.target.select();
        selectedNode.value = e.target;
      });

      cy.value.on('tap', 'edge', e => {
        cy.value.elements().unselect();
        e.target.select();
        selectededge.value = e.target;
      });
    }

    // 5. 渲染新图
    cy.value.elements().remove();
    cy.value.add([...nodes, ...edges]);

    await nextTick();
    cy.value.layout({
      name: 'fcose',
      animate: false,
      randomize: true,
      nodeRepulsion: 30000,
      // idealEdgeLength: 50,
      quality: 'default',
      samplingEnabled: false,
      padding: 100,
      nodeOverlap: false
    }).run();

    // 6. 更新统计与图例
    nodeCount.value = cy.value.nodes().length;
    edgeCount.value = cy.value.edges().length;

    const legendMap = {};
    cy.value.nodes().forEach(node => {
      const lbls = node.data('labels') || [];
      const key  = lbls.length ? lbls[0] : '其他';
      if (!legendMap[key]) {
        legendMap[key] = { label: key, count: 0, color: node.data('color') };
      }
      legendMap[key].count++;
    });
    legendData.value = Object.values(legendMap);

  } catch (err) {
    console.error('查询失败：', err);
    alert('查询失败，请检查后端服务或查询语法。');
  } finally {
    requestAnimationFrame(() => {
      cy.value.resize();
      cy.value.center();
    });
    loading.value = false;
  }
};

const closeNodeDetail = () => {
  if (cy.value) {
    // 1. 取消所有选中状态
    cy.value.elements().unselect() 
    // 2. 通过重置样式强制刷新（仅在必要时使用）
    cy.value.style().update() 
  }
  // 3. 清空选中节点引用
  selectedNode.value = null
}
const closeedgeDetail = () => {
  if (cy.value) {
    // 1. 取消所有选中状态
    cy.value.elements().unselect() 
    // 2. 通过重置样式强制刷新（仅在必要时使用）
    cy.value.style().update() 
  }
  // 3. 清空选中节点引用
  selectededge.value = null
}


onMounted(() => {
  if (!cyContainer.value) {
      error.value = "图谱容器未能正确初始化。";
  }
  // 自动加载一次CSV数据作为演示
  loadGraph(); // 如果您希望页面加载时自动执行一次，可以取消此行注释
});

onUnmounted(() => {

});

</script>

<style scoped>
.user-select-none {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}
</style>