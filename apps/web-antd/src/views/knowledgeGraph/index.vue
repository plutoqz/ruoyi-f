<template>
  <div id="kg-container">
    
    <div class="flex flex-col h-screen p-4 space-y-4 font-inter">
      <!-- 查询输入框和按钮 -->
      <div class="flex space-x-2 items-center">
        <input
          v-model="cypherQuery"
          placeholder="输入 Cypher 查询语句"
          class="flex-1 border rounded px-3 py-2"
        />
        <button @click="loadGraph" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          查询
        </button>
      </div>
      
      <div class="flex flex-1 space-x-4 overflow-hidden">
        <div class="w-64 bg-gray-50 border border-gray-200 rounded-lg flex flex-col shadow-sm">
          <div class="p-4 space-y-3">
            <h3 class="text-md font-semibold text-gray-700 mb-3">图谱数据操作</h3>
            <button class="w-full bg-sky-500 text-white px-4 py-2 rounded-lg hover:bg-sky-600 transition duration-150 ease-in-out shadow-sm">
              知识查阅
            </button>
            <button class="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition duration-150 ease-in-out shadow-sm">
              知识更新
            </button>
            <button class="w-full bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition duration-150 ease-in-out shadow-sm">
              知识修改
            </button>
            <!-- <button class="w-full bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 transition duration-150 ease-in-out shadow-sm">
              查询节点
            </button> -->
          </div>
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
                       <span class="text-gray-700">{{ item.label }}</span>
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
          <div ref="cyContainer" class="flex-1 w-full h-full"></div>
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
      
      <button
        @click="openMapModal(null)"
        class="fixed right-0 top-1/2 transform -translate-y-1/2 bg-blue-500 text-white p-1 rounded-l-lg shadow-md hover:bg-blue-600 opacity-80 hover:opacity-100 transition-all duration-200 z-20 flex items-center space-x-1"
        title="打开地图"
      >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12.004 11.73q.667 0 1.14-.475t.472-1.143t-.476-1.14t-1.143-.472t-1.14.476t-.472 1.143t.475 1.14t1.144.472M12 19.677q2.82-2.454 4.458-4.991t1.638-4.39q0-2.744-1.737-4.53Q14.62 3.981 12 3.981T7.641 5.766t-1.737 4.53q0 1.852 1.638 4.39T12 19.677m0 1.342q-3.525-3.117-5.31-5.814q-1.786-2.697-1.786-4.909q0-3.173 2.066-5.234Q9.037 3 12 3t5.03 2.062q2.066 2.061 2.066 5.234q0 2.212-1.785 4.909q-1.786 2.697-5.311 5.814m0-10.903"/></svg>
         </button>

      <div v-if="isMapModalVisible" class="fixed top-10 right-10 bg-white rounded-lg shadow-xl border border-gray-300 z-30 flex flex-col"
        :style="{
        top: position.y + 'px',
        left: position.x + 'px',
        width: '15vw',
        height: '40vh'
      }">

          <div class="flex justify-between items-center p-3 border-b bg-gray-50 rounded-t-lg cursor-move"@mousedown.prevent="startDragging">
            <h3 class="text-md font-semibold text-gray-800">地图视图</h3>
            <button @click="closeMapModal" class="text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class=" h-[calc(100%-45px)] overflow-hidden"> 
            <div id="map-container" class="w-full h-full bg-gray-100 rounded flex items-center justify-center text-gray-500 text-center">
              <GaodeMap :locationname="nodeLocationName" />
          </div>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup>
import { ref ,onMounted ,nextTick, onUnmounted } from 'vue'
import cytoscape from 'cytoscape'
import fcose from 'cytoscape-fcose'
import axios from 'axios'
import GaodeMap from 'E:/vscode/my-ruoyi-admin-webgis/ruoyi-admin/apps/web-antd/src/views/maps/index.vue'
cytoscape.use(fcose);

const cyContainer = ref(null)
const cy = ref(null)
const loading = ref(false)
const cypherQuery = ref('MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 20')
const selectedNode = ref(null)
const selectededge = ref(null)
const nodeCount = ref(0)
const edgeCount = ref(0)
const legendData = ref([]);

const isMapModalVisible = ref(false); // 地图弹窗可见性
const nodeLocationName = ref('')

// 弹窗位置数据
const position = ref({ x: 300, y: 450 })
const startPos = ref({ x: 0, y: 0 })
const isDragging = ref(false)

// 开始拖动
const startDragging = (e) => {
  isDragging.value = true
  startPos.value = {
    x: e.clientX - position.value.x,
    y: e.clientY - position.value.y
  }
  
  // 添加全局事件监听
  document.addEventListener('mousemove', onDragging)
  document.addEventListener('mouseup', stopDragging)
}

// 拖动中
const onDragging = (e) => {
  if (!isDragging.value) return
  
  position.value = {
    x: e.clientX - startPos.value.x,
    y: e.clientY - startPos.value.y
  }
}

// 停止拖动
const stopDragging = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDragging)
  document.removeEventListener('mouseup', stopDragging)
}

// 定义标签到颜色的映射，根据实际情况进行调整
const labelColorMap = {
  // "法律": "#711007",
  // "章节": "#f76c5e",
  // "条款": "#f68e5f",
  // "土地": "#c9c19f",
  // "规划": "#50c5b7",
  // "制度": "#9cec5b",
  // "处罚":"#000000",
  // "权利":"#586ba4",
  // "义务":"#324376",
  // "政府机构":"#ddb771",
  // "其他":"#6d3d14",
  // "修订历史":"#b59da4",
  // "法律主体":"#6494aa",

  "数据":"#a6d0e4",
  "镇区":"#ff8364",
  "业务知识":"#d4a5a5",
  "地级市":"#355c7d",
  "省份":"#c06c84",
  "地块":"#649dad",
  "村":"#f67280",
  "指标":"#aca8ff",
  // 可以继续添加其他标签...
}
// 动态颜色存储表（新增）
const dynamicColorMap = {};

// 生成随机颜色函数（优化了十六进制格式校验）
const getRandomColor = () => {
  const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16);
  return `#${hex.padStart(6, '0')}`; // 确保6位十六进制 [[6]]
};

const getColorForLabels = (labels) => {
  const labelArray = Array.isArray(labels) ? labels : [labels];
  
  for (const label of labelArray) {
    // 优先匹配预定义颜色
    if (labelColorMap[label]) {
      return labelColorMap[label];
    }
    // 处理未定义标签的固定随机颜色
    if (!dynamicColorMap[label]) {
      dynamicColorMap[label] = getRandomColor(); // 生成并缓存颜色 [[4]]
    }
    return dynamicColorMap[label]; // 直接返回已缓存颜色
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
/**
 * 加载图数据并在 Cytoscape 中展示。
 * 此函数包含对节点和关系（边）的处理：
 * 1. 遍历查询结果创建节点对象，并排重（防止重复添加）。
 * 2. 再次遍历查询结果，处理边数据；如果关系中的起始或结束节点不存在，则
 *    自动创建“虚拟”节点以满足 Cytoscape 创建边的要求。
 */
const loadGraph = async () => {
  loading.value = true
  selectedNode.value = null
  selectededge.value = null
  legendData.value = [];
  //const startTime = performance.now();
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
    
    // 如果 Cytoscape 实例不存在则初始化
    if (!cy.value) {
      cy.value = cytoscape({
        container: cyContainer.value, // 渲染图的容器
        style: [
          {
            selector: 'node',
            style: {
              label: function(ele) {
                // 获取节点的 '市'、'区镇'、'村' 属性
                const shi = ele.data('市');
                const quZhen = ele.data('区镇');
                const cun = ele.data('村');
                const name = ele.data('name'); // 获取原始的 name 属性

                // 按照优先级返回标签
                if (cun) {
                  return cun;
                } else if (quZhen) {
                  return quZhen;
                } else if (shi) {
                  return shi;
                } else {
                  return name; // 如果以上都没有，则显示 name 属性
                }
              },        
              'background-color': 'data(color)',   // 节点颜色根据 data.color 属性设置
              'text-valign': 'center',             // 文本垂直居中
              'text-halign': 'center',             // 文本水平居中
              'font-size': '8px',                 // 字体大小
              'color': '#fff',                     // 文字颜色为白色
              //'text-wrap': 'ellipsis',                 // 开启自动换行，防止文字过长溢出/ellipsis/wrap
              //'text-max-width': '18',            // 文字最大宽度
            }
          },
          {
            selector: 'edge',
            style: {
              width: 1,                          // 边的宽度
              'line-color': '#88ada6',              // 边的颜色
              'target-arrow-color': '#88ada6',      // 箭头颜色
              'target-arrow-shape': 'triangle',  // 箭头形状（三角形）
              'curve-style': 'bezier'            // 曲线样式，使用贝塞尔曲线
            }
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': '2px',       // 边框宽度
              'border-color': '#44cef6',   // 边框颜色 (金色，你可以换成任何你喜欢的颜色，如 #00FFFF 亮青色)
              'border-style': 'solid',     // 边框样式
              'font-size': '10px',          // 字体大小
              'color': '#e3f9fd',          // 文字颜色
            }
          }
        ]
      })
      // 单击节点时显示详情；绑定点击事件，更新 selectedNode 状态
      cy.value.on('tap', 'node', (e) => {
        // 先取消所有选中
        cy.value.elements().unselect()
        // 再选中当前节点
        e.target.select()
        selectedNode.value = e.target
        const loc = e.target.data('村')||e.target.data('市')||e.target.data('区镇');
        if (loc) {
          nodeLocationName.value=loc;
          isMapModalVisible.value = true;
        }
      })
      cy.value.on('tap','edge',(e) =>{
        // 先取消所有选中
        cy.value.elements().unselect()
        // 再选中当前关系
        e.target.select()
        selectededge.value = e.target
      })
    }

    // 清除 Cytoscape 中的已有元素
    cy.value.elements().remove()
    // 添加新加载的节点和边
    cy.value.add([...nodes, ...edges])
    // await nextTick()  // 确保容器大小已更新
    // cy.value.batch(() => {
    //   cy.value.elements().remove()
    //   cy.value.add(nodes.concat(edges))
    // })
    // 重新执行力导向布局，以生成更合理的展示效果
    await nextTick(); // 等待 DOM 更新
    //cy.value.resize()
    //const N = nodes.length
    cy.value.layout({
      name: 'fcose',        // 使用 cose 布局
      animate: false,
      randomize: true, // 是否随机初始位置
      nodeRepulsion: 10000, // 降低排斥力计算复杂度
      idealEdgeLength: 50,
      quality: "default", // 可选"low"进一步提速
      samplingEnabled: false, // 关闭采样提高精度
      //fit: true,
      padding: 30
      // rows: Math.ceil(Math.sqrt(N)),
      // cols: Math.ceil(Math.sqrt(N)),
      // fit: true,
      // padding: 30,
      // animate: false
    }).run()

    // 更新节点和关系数量
    nodeCount.value = cy.value.nodes().length
    edgeCount.value = cy.value.edges().length
    // 新增代码：统计各节点标签的图例数据
    const legendMap = {}
    cy.value.nodes().forEach(node => {
      // 假设每个节点的 labels 是数组，取第一个作为标签，如果不存在则归为 '其他'
      const labels = node.data('labels')
      const label = labels && labels.length ? labels[0] : '其他'
      // 如果图例中还没有该标签，则初始化一个条目
      if (!legendMap[label]) {
        legendMap[label] = {
          label: label,
          count: 0,
          color: node.data('color') || '#888'
        }
      }
      legendMap[label].count++
    })
    // 将统计结果转换为数组并赋值给 legendData
    legendData.value = Object.values(legendMap)
  } catch (err) {
    console.error('查询失败：', err)
    alert('查询失败，请检查后端服务或查询语法。')
  } finally {
    // const finishTime2 = performance.now();
    // console.log(finishTime2 - startTime);
    //确保在下一个浏览器渲染帧执行
    requestAnimationFrame(() => {
      cy.value.resize() // 强制刷新容器尺寸计算
      //cy.value.fit()
      cy.value.center()
    })
    loading.value = false
  }
}

/**
 * 关闭节点详情面板，并取消 Cytoscape 中所有节点的选中状态，
 * 避免选中状态影响节点样式。
 */
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

// 打开地图弹窗
const openMapModal = (node) => {
  isMapModalVisible.value = true;
};

// 关闭地图弹窗
const closeMapModal = () => {
  isMapModalVisible.value = false;
  // 可选：销毁地图实例以释放资源
  // if (mapInstance.value) {
  //   mapInstance.value.remove();
  //   mapInstance.value = null;
  // }
  // 下一帧计算位置
  nextTick(() => {
    const modalWidth = 15 * window.innerWidth / 100  // 15vw
    const modalHeight = 40 * window.innerHeight / 100 // 40vh
    position.value = {
      x: window.innerWidth/2 - modalWidth/2,
      y: window.innerHeight/2 - modalHeight/2
    }
  })
};

onMounted(async () => {

  await nextTick(); // 等待 DOM 更新
  if (cy.value) {
    cy.value.resize(); // 强制重新计算容器尺寸
  }
  await loadGraph();
})
// 组件卸载时移除监听器
onUnmounted(() => {
  document.removeEventListener('mousemove', onDragging)
  document.removeEventListener('mouseup', stopDragging)
})
</script>

<style scoped>
/* #map-container {
  width: 100%;
  height: 100vh;
} */
/* #cyContainer {
  min-height: 500px; 
  transition: height 0.3s; 
} */
.user-select-none {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
}
</style>
