<template>
    <div class="kg-generator">
        <!-- <header class="header">
            <h1>知识图谱生成系统</h1>
        </header> -->

        <div class="main-content">
            <!-- 左侧控制面板 -->
            <div class="control-panel">
                <!-- 1. 文件上传 -->
                <div class="card">
                    <h2>1. 矢量数据上传</h2>
                    <div class="upload-box" @dragover.prevent @drop="handleDrop">
                        <div v-if="!file" class="upload-placeholder">
                            <i class="upload-icon">📁</i>
                            <p>拖放 <strong>.json</strong> 文件或 <strong>.geojson</strong> 到此处 或</p>
                            <button class="btn primary" @click="triggerFileInput">选择文件</button>
                        </div>
                        <div v-else class="file-info">
                            <i class="file-icon">✔️</i>
                            <p><strong>{{ file.name }}</strong></p>
                            <p class="file-size">数据已加载 ({{ jsonData.length }}条记录, {{ attributeFields.length }}个字段)</p>
                            <button class="btn small danger" @click="removeFile">移除文件</button>
                        </div>
                        <input type="file" ref="fileInput" @change="handleFileChange" style="display: none"  accept=".json,.geojson"/>
                    </div>
                </div>

                <!-- 2. 节点定义 -->
                <div class="card" v-if="file">
                    <h2>2. 节点定义</h2>
                    <div class="definition-list">
                        <div class="definition-item" v-for="(nodeDef, index) in nodeDefinitions" :key="nodeDef.id">
                            <div class="inputs">
                                <div class="basic-inputs">
                                    <div>
                                        <label :for="'node-name-' + nodeDef.id">节点类型</label>
                                        <input :id="'node-name-' + nodeDef.id" type="text" v-model="nodeDef.name" placeholder="例如: 地块">
                                    </div>
                                    <div>
                                        <label :for="'node-field-' + nodeDef.id">唯一标识字段</label>
                                        <select :id="'node-field-' + nodeDef.id" v-model="nodeDef.field">
                                            <option disabled value="">请选择字段</option>
                                            <option v-for="field in attributeFields" :key="field" :value="field">{{ field }}</option>
                                        </select>
                                    </div>
                                    <div class="property-selection">
                                        <label>节点属性 (可选)</label>
                                        <div class="multi-select-trigger" @click.stop="togglePropertiesDropdown(nodeDef)">
                                            <span>{{ nodeDef.properties.length }} 个已选择</span>
                                            <i class="arrow-icon" :class="{ up: nodeDef.isPropertiesOpen }"></i>
                                        </div>
                                        <div v-if="nodeDef.isPropertiesOpen" class="multi-select-dropdown" @click.stop>
                                            <div class="dropdown-header">
                                                <input type="text" v-model="nodeDef.propertySearchTerm" placeholder="搜索属性...">
                                            </div>
                                            <div class="dropdown-actions">
                                                <button class="btn small" @click="selectAllProperties(nodeDef)">全选</button>
                                                <button class="btn small" @click="deselectAllProperties(nodeDef)">清空</button>
                                            </div>
                                            <div class="dropdown-options">
                                                <!-- **逻辑修复**: 移除外层div的click事件，将事件绑定到checkbox上 -->
                                                <div v-for="field in getFilteredFields(nodeDef)" :key="field" class="checkbox-item">
                                                    <input type="checkbox" 
                                                        :id="'prop-' + nodeDef.id + '-' + field" 
                                                        :value="field" 
                                                        :checked="nodeDef.properties.includes(field)" 
                                                        :disabled="field === nodeDef.field"
                                                        @change="toggleProperty(nodeDef, field)">
                                                    <label :for="'prop-' + nodeDef.id + '-' + field">{{ field }}</label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label :for="'node-label-field-' + nodeDef.id">节点显示名称</label>
                                        <select :id="'node-label-field-' + nodeDef.id" v-model="nodeDef.labelField">
                                            <option value="">-- 使用唯一标识 --</option>
                                            <option v-for="field in attributeFields" :key="field" :value="field">{{ field }}</option>
                                        </select>
                                    </div>
                                </div>
                                <!-- **新增**: 属性选择 -->
                                
                            </div>
                            <button class="btn small danger delete-btn" @click="removeNodeDefinition(index)">删除</button>
                        </div>
                    </div>
                    <button class="btn btn-add" @click="addNodeDefinition">
                        + 添加节点类型
                    </button>
                </div>

                <!-- 3. 关系定义 -->
                <div class="card" v-if="file && nodeDefinitions.length > 0">
                    <h2>3. 关系定义</h2>
                    <div class="definition-list">
                        <div class="definition-item" v-for="(relDef, index) in relationshipDefinitions" :key="relDef.id">
                            <div class="inputs">
                                <div class="input-row">
                                <div><label :for="'rel-source-' + relDef.id">源节点类型</label><select :id="'rel-source-' + relDef.id" v-model="relDef.source"><option disabled value="">选择源节点</option><option v-for="nodeType in definedNodeTypes" :key="nodeType" :value="nodeType">{{ nodeType }}</option></select></div>
                                <div><label :for="'rel-target-' + relDef.id">目标节点类型</label><select :id="'rel-target-' + relDef.id" v-model="relDef.target"><option disabled value="">选择目标节点</option><option v-for="nodeType in definedNodeTypes" :key="nodeType" :value="nodeType">{{ nodeType }}</option></select></div>
                                </div>
                                <div class="input-row">
                                    <div><label :for="'rel-type-' + relDef.id">关系名称</label><input :id="'rel-type-' + relDef.id" type="text" v-model="relDef.type" placeholder="例如: 拥有"></div>
                                    <div><label :for="'rel-method-' + relDef.id">连接方式</label><select :id="'rel-method-' + relDef.id" v-model="relDef.method"><option value="cross">交叉连接(全部互联)</option><option value="field">根据字段连接</option></select></div>
                                </div>
                                <div class="input-row">
                                        <!-- <div>
                                            <label :for="'rel-source-identifier-' + relDef.id">源节点标识字段</label>
                                            <select :id="'rel-source-identifier-' + relDef.id" v-model="relDef.sourceIdentifier" disabled>
                                                <option :value="getSourceIdentifier(relDef.source)">{{ getSourceIdentifier(relDef.source) || '请先选择源节点' }}</option>
                                            </select>
                                        </div> -->
                                        <div>
                                            <label :for="'rel-target-foreignKey-' + relDef.id">目标中的外键字段</label>
                                            <select :id="'rel-target-foreignKey-' + relDef.id" v-model="relDef.targetForeignKey">
                                                <option disabled value="">选择字段</option>
                                                <option v-for="field in attributeFields" :key="field" :value="field">{{ field }}</option>
                                            </select>
                                        </div>
                                    </div>
                            </div>
                            <button class="btn small danger delete-btn" @click="removeRelationshipDefinition(index)">删除</button>
                        </div>
                    </div>
                    <button class="btn btn-add" @click="addRelationshipDefinition">
                        + 添加关系
                    </button>
                </div>
                
                <!-- 4. 操作 -->
                <div class="card" v-if="file">
                    <h2>4. 生成图谱</h2>
                    <div class="action-buttons">
                        <button class="btn primary large" @click="generateKG" :disabled="isGenerating">
                            {{ isGenerating ? '生成中...' : '生成知识图谱' }}
                        </button>
                        <button class="btn secondary large" @click="resetForm">重置所有</button>
                    </div>
                </div>
            </div>

            <!-- 右侧可视化区域 -->
            <div class="visualization-panel">
                <h2>知识图谱可视化</h2>
                <div class="graph-container">
                    <div ref="cyContainer" class="cy-container"></div>
                    <div v-if="isGenerating" class="overlay loading-indicator">
                        <div class="spinner"></div>
                        <p>正在生成知识图谱...</p>
                    </div>
                    <div v-else-if="!graphData || graphData.nodes.length === 0" class="overlay empty-graph">
                        <i class="graph-icon">🌐</i>
                        <p>知识图谱将在这里展示</p>
                        <p>请先在左侧定义节点和关系，然后点击 "生成知识图谱"</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, nextTick ,watch, onMounted } from 'vue';
import cytoscape from 'cytoscape';
import fcose from 'cytoscape-fcose';
cytoscape.use(fcose);

// --- 响应式状态 ---
const fileInput = ref(null); // 文件输入框的引用
const file = ref(null); // 存储上传的文件信息
const jsonData = ref([]); //json文件数据
const attributeFields = ref([]); // 存储数据源的字段名

const nodeDefinitions = ref([]); // 节点定义列表
const relationshipDefinitions = ref([]); // 关系定义列表

const isGenerating = ref(false); // 是否正在生成图谱
const graphData = ref({ nodes: [], edges: [] }); // 最终生成的图谱数据

const cyContainer = ref(null);
let cyInstance = null; 

// --- 计算属性 ---
// 获取已定义的节点类型名称，用于关系定义的下拉菜单
const definedNodeTypes = computed(() =>
    nodeDefinitions.value.map(def => def.name).filter(name => name)
);

onMounted(() => {
    // // 注册 Cytoscape 布局插件
    // if (window.cytoscape && window.cytoscapeFcose) {
    //     cytoscape.use(window.cytoscapeFcose);
    // } else {
    //     console.error('Cytoscape or Fcose layout not loaded.');
    // }
});


const getSourceIdentifier = (nodeTypeName) => {
                const nodeDef = nodeDefinitions.value.find(def => def.name === nodeTypeName);
                return nodeDef ? nodeDef.field : '';
            };

// --- 方法 ---

// 触发文件选择框
const triggerFileInput = () => {
    fileInput.value.click();
};

// 处理文件拖放
const handleDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        // 确保是JSON文件
        if (files[0].type === 'application/json' || 'application/geojson') {
            processFile(files[0]);
        } else {
            alert("请拖放一个有效的.json文件。");
        }
    }
};

// 处理文件选择
const handleFileChange = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
        processFile(files[0]);
    }
};

// 核心文件处理逻辑
const processFile = (selectedFile) => {
    console.log("处理文件:", selectedFile.name);
    file.value = { name: selectedFile.name, size: selectedFile.size };

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const parsedData = JSON.parse(e.target.result);
            let dataArray = null;

            // 检查根是否为数组
            if (Array.isArray(parsedData)) {
                dataArray = parsedData;
            } 
            // 如果根是对象，则查找第一个值为数组的键
            else if (typeof parsedData === 'object' && parsedData !== null) {
                const key = Object.keys(parsedData).find(k => Array.isArray(parsedData[k]));
                if (key) {
                    dataArray = parsedData[key];
                }
            }

            // 在尝试查找后，验证数组是否有效
            if (!dataArray || dataArray.length === 0) {
                alert("无法在JSON文件中找到有效的、非空的数据数组。请确保文件内容直接是一个数组，或一个包含数据数组的对象。");
                removeFile();
                return;
            }

            // 兼容 { "properties": {...} } (类似GeoJSON) 和扁平结构
            const isGeoJsonLike = dataArray[0] && dataArray[0].properties && typeof dataArray[0].properties === 'object';
            const dataRecords = isGeoJsonLike ? dataArray.map(item => item.properties) : dataArray;
            
            // 提取第一条记录的键作为属性字段
            const firstRecord = dataRecords[0];
            if (typeof firstRecord !== 'object' || firstRecord === null) {
                alert("JSON数组中的元素必须是对象。");
                removeFile();
                return;
            }

            jsonData.value = dataRecords;
            attributeFields.value = Object.keys(firstRecord);
            
            resetDefinitions();

            nextTick(() => {
                addNodeDefinition();
            });

        } catch (error) {
            console.error("解析JSON文件失败:", error);
            alert(`无法解析JSON文件: ${error.message}`);
            removeFile();
        }
    };

    reader.onerror = (e) => {
        console.error("读取文件失败:", e);
        alert("读取文件时发生错误。");
        removeFile();
    };

    reader.readAsText(selectedFile);
};

// 移除文件
const removeFile = () => {
    file.value = null;
    attributeFields.value = [];
    jsonData.value = [];
    if (fileInput.value) {
      fileInput.value.value = ''; // 清空文件输入框
    }
    resetDefinitions();
};

const resetDefinitions = () => {
    nodeDefinitions.value = [];
    relationshipDefinitions.value = [];
    if (cyInstance) {
        cyInstance.destroy();
        cyInstance = null;
    }
    graphData.value = { nodes: [], edges: [] };
}

// --- 节点定义相关方法 ---
const addNodeDefinition = () => {
    const newId = Date.now();
    nodeDefinitions.value.push({ 
        id: newId, 
        name: '', 
        field: '', 
        properties: [] // 新增
    });
};

const removeNodeDefinition = (index) => {
    nodeDefinitions.value.splice(index, 1);
};
// --- 属性选择下拉框逻辑 ---
const togglePropertiesDropdown = (nodeDef) => {
    nodeDef.isPropertiesOpen = !nodeDef.isPropertiesOpen;
};

const closeAllDropdowns = () => {
    nodeDefinitions.value.forEach(def => def.isPropertiesOpen = false);
};

const getFilteredFields = (nodeDef) => {
    if (!nodeDef.propertySearchTerm) {
        return attributeFields.value;
    }
    return attributeFields.value.filter(field => 
        field.toLowerCase().includes(nodeDef.propertySearchTerm.toLowerCase())
    );
};

const toggleProperty = (nodeDef, field) => {
        if (field === nodeDef.field) return;
        const index = nodeDef.properties.indexOf(field);
        if (index > -1) {
            nodeDef.properties.splice(index, 1);
        } else {
            nodeDef.properties.push(field);
        }
};

const selectAllProperties = (nodeDef) => {
    nodeDef.properties = attributeFields.value.filter(f => f !== nodeDef.field);
};

const deselectAllProperties = (nodeDef) => {
    nodeDef.properties = [];
};
// --- 关系定义相关方法 ---
const addRelationshipDefinition = () => relationshipDefinitions.value.push({ id: Date.now(), source: '', target: '', type: '', method: 'cross', sourceField: '', targetField: '' });

const removeRelationshipDefinition = (index) => {
    relationshipDefinitions.value.splice(index, 1);
};

// --- 表单和图谱生成 ---
const resetForm = () => {
    removeFile();
};

// 生成知识图谱
const generateKG = () => {
    if (isGenerating.value) return;
    isGenerating.value = true;
    graphData.value = { nodes: [], edges: [] };

    setTimeout(() => {
        try {
            const nodes = [];
            const nodeValueMap = new Map(); 

            nodeDefinitions.value.forEach(def => {
                if (!def.name || !def.field) return;
                jsonData.value.forEach((item) => {
                    const nodeValue = item[def.field];
                    if (nodeValue !== null && nodeValue !== undefined) {
                        const nodeId = `${def.name}_${nodeValue}`;
                        const mapKey = `${def.name}-${nodeValue}`;
                        if (!nodeValueMap.has(mapKey)) {
                            const displayLabel = def.labelField ? item[def.labelField] : nodeValue;
                            const newNode = { 
                                id: nodeId, 
                                label: String(displayLabel), 
                                type: def.name, 
                                properties: item 
                            };
                            nodes.push(newNode);
                            nodeValueMap.set(mapKey, newNode);
                        }
                    }
                });
            });

            const edges = [];
            relationshipDefinitions.value.forEach(relDef => {
                if (!relDef.source || !relDef.target || !relDef.type) return;
                
                // **核心逻辑修复**: 处理归属关系 (例如 村庄 -> 拥有 -> 地块)
                if (relDef.method === 'field' && relDef.targetForeignKey) {
                    const sourceIdentifierField = getSourceIdentifier(relDef.source);
                    if (!sourceIdentifierField) return;

                    // 建立一个快速查找源节点的Map
                    const sourceNodeMap = new Map();
                    nodes.filter(n => n.type === relDef.source).forEach(sNode => {
                        sourceNodeMap.set(sNode.properties[sourceIdentifierField], sNode);
                    });

                    // 遍历目标节点，根据外键查找源节点并创建连接
                    nodes.filter(n => n.type === relDef.target).forEach(tNode => {
                        const foreignKeyValue = tNode.properties[relDef.targetForeignKey];
                        if (foreignKeyValue !== undefined && sourceNodeMap.has(foreignKeyValue)) {
                            const sourceNode = sourceNodeMap.get(foreignKeyValue);
                            if (sourceNode.id !== tNode.id) {
                                edges.push({ id: `e_${sourceNode.id}_${tNode.id}_${Math.random()}`, source: sourceNode.id, target: tNode.id, label: relDef.type });
                            }
                        }
                    });
                }
                // 交叉连接逻辑保持不变
                else if (relDef.method === 'cross') {
                    const sourceNodes = nodes.filter(n => n.type === relDef.source);
                    const targetNodes = nodes.filter(n => n.type === relDef.target);
                    sourceNodes.forEach(sNode => {
                        targetNodes.forEach(tNode => {
                            if (sNode.id !== tNode.id) {
                                edges.push({ id: `e_${sNode.id}_${tNode.id}`, source: sNode.id, target: tNode.id, label: relDef.type });
                            }
                        });
                    });
                }
            });

            graphData.value = { nodes, edges };
            nextTick(() => renderGraph(graphData.value));
        
        } catch (error) {
            console.error("生成图谱失败:", error);
            alert(`生成图谱时出错: ${error.message}`);
        } finally {
            isGenerating.value = false;
        }
    }, 100);
};

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

// **新增**: Cytoscape渲染函数
const renderGraph = (data) => {
    if (!cyContainer.value) return;
    
    if (cyInstance) {
        cyInstance.destroy();
    }
    console.log('触发渲染');
    const elements = [];
    data.nodes.forEach(node => {
        elements.push({
            group: 'nodes',
            data: {
                id: node.id,
                name: node.label,
                color: getColorForType(node.type)
            }
        });
    });
    data.edges.forEach(edge => {
        elements.push({
            group: 'edges',
            data: {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.label
            }
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
        layout: { name: 'fcose', animate: true, nodeRepulsion: 4500, idealEdgeLength: 100 }
    });
};
// 监视节点定义的唯一标识字段变化
// 当唯一标识字段被选中时，自动将其从可勾选的属性中移除，避免重复
watch(nodeDefinitions, (newDefs) => {
                newDefs.forEach(def => {
                    if (def.field && def.properties.includes(def.field)) {
                        def.properties = def.properties.filter(p => p !== def.field);
                    }
                });
            }, { deep: true });
</script>

<style scoped>
@import './Structure.scss';
</style>