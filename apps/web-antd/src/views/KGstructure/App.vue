<template>
  <div class="kg-generator">
    <div class="main-content">
      <!-- Left Control Panel -->
      <div class="control-panel">
        <DataSourceManager 
          :data-sources="dataSources"
          :is-processing="isProcessingFile"
          @add-source="handleAddNewSource"
          @remove-source="handleRemoveSource"
        />

        <NodeDefinitionPanel 
          v-if="dataSources.length > 0" 
          :attribute-fields="allAttributeFieldsWithSources"
          v-model="nodeDefinitions"
        />

        <RelationshipDefinitionPanel 
          v-if="dataSources.length > 0 && nodeDefinitions.length > 0"
          :attribute-fields="allAttributeFieldsWithSources"
          :node-definitions="nodeDefinitions"
          v-model="relationshipDefinitions"
        />
        
        <GraphControlPanel
          v-if="dataSources.length > 0"
          :is-generating="isGeneratingGraph"
          @generate-graph="generateKG"
          @reset-all="resetAll"
        />
      </div>

      <!-- Right Visualization Panel -->
      <GraphVisualizer 
        :graph-data="graphData" 
        :is-generating="isGeneratingGraph || isProcessingFile" 
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';
import DataSourceManager from './DataSourceManager.vue';
import NodeDefinitionPanel from './NodeDefinitionPanel.vue';
import RelationshipDefinitionPanel from './RelationshipDefinitionPanel.vue';
import GraphControlPanel from './GraphControlPanel.vue';
import GraphVisualizer from './GraphVisualizer.vue';

// --- State ---
const dataSources = ref([]);
const nodeDefinitions = ref([]);
const relationshipDefinitions = ref([]);
const graphData = ref({ nodes: [], edges: [] });
const isGeneratingGraph = ref(false);
const isProcessingFile = ref(false);

// const API_BASE_URL = 'http://localhost:8080/shp';

// --- Computed Properties ---
// FIX #3: Provide attributes with their source file names
const allAttributeFieldsWithSources = computed(() => {
  const fieldMap = new Map();
  dataSources.value.forEach(source => {
    source.attributeFields.forEach(field => {
      if (!fieldMap.has(field)) {
        fieldMap.set(field, new Set());
      }
      fieldMap.get(field).add(source.name);
    });
  });
  
  const result = [];
  for (const [field, sources] of fieldMap.entries()) {
    result.push({ field, sources: Array.from(sources) });
  }
  return result;
});

// --- Methods ---

// FIX #1: Simplified state management for file processing
const handleAddNewSource = (file) => {
  isProcessingFile.value = true;
  const onComplete = (success) => {
    isProcessingFile.value = false;
  };

  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.zip')) {
    processZipFileWithBackend(file, onComplete);
  } else if (fileName.endsWith('.json') || fileName.endsWith('.geojson')) {
    processJsonFileInFrontend(file, onComplete);
  } else {
    alert("不支持的文件类型。");
    onComplete(false);
  }
};

const handleRemoveSource = (index) => {
  dataSources.value.splice(index, 1);
  if (dataSources.value.length === 0) {
      resetDefinitions();
  }
};

const addDataSourceToList = (sourceData) => {
    dataSources.value.push({
        id: Date.now(),
        name: sourceData.name,
        jsonData: sourceData.jsonData,
        attributeFields: sourceData.attributeFields,
        recordCount: sourceData.jsonData.length
    });
    if (nodeDefinitions.value.length === 0) {
        nodeDefinitions.value.push({ 
            id: Date.now(), name: '', field: '', labelField: '',
            properties: [], isPropertiesOpen: false, propertySearchTerm: ''
        });
    }
};

const resetDefinitions = () => {
    nodeDefinitions.value = [];
    relationshipDefinitions.value = [];
    graphData.value = { nodes: [], edges: [] };
};

const resetAll = () => {
  dataSources.value = [];
  resetDefinitions();
};

const processJsonFileInFrontend = (file, onComplete) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsedData = JSON.parse(e.target.result);
            let features = [];
            if (Array.isArray(parsedData)) features = parsedData;
            else if (parsedData.type === 'FeatureCollection') features = parsedData.features.map(f => f.properties);
            
            const firstRecord = features[0] || {};
            addDataSourceToList({ name: file.name, jsonData: features, attributeFields: Object.keys(firstRecord) });
            onComplete(true);
        } catch (error) {
            alert(`解析JSON失败: ${error.message}`);
            onComplete(false);
        }
    };
    reader.onerror = () => { alert('读取文件失败'); onComplete(false); };
    reader.readAsText(file);
};

const processZipFileWithBackend = async (file, onComplete) => {
    const formData = new FormData();
    formData.append('file', file);
    let poll;
    try {
        const uploadRes = await fetch(`/api/files/upload`, { method: 'POST', body: formData });
        if (!uploadRes.ok) throw new Error(`上传失败: ${uploadRes.statusText}`);
        const { taskId } = await uploadRes.json();

        poll = setInterval(async () => {
            const statusRes = await fetch(`/api/files/status/${taskId}`);
            const { status, error } = await statusRes.json();
            if (status === 'COMPLETED') {
                clearInterval(poll);
                const dataRes = await fetch(`/api/files/data/${taskId}`);
                const jsonData = await dataRes.json();
                const firstRecord = jsonData[0] || {};
                addDataSourceToList({ name: file.name, jsonData: jsonData, attributeFields: Object.keys(firstRecord) });
                onComplete(true);
            } else if (status === 'FAILED') {
                clearInterval(poll);
                throw new Error(error || '后端解析失败');
            }
        }, 2000);
    } catch (error) {
        clearInterval(poll);
        alert(`处理ZIP文件失败: ${error.message}`);
        onComplete(false);
    }
};

const generateKG = () => {
  isGeneratingGraph.value = true;
  graphData.value = { nodes: [], edges: [] };

  setTimeout(() => {
    try {
      // ... (节点生成部分保持不变) ...

      const allNodes = [];
      const nodeValueMap = new Map();
      
      dataSources.value.forEach(source => {
        nodeDefinitions.value.forEach(def => {
          if (!def.name || !def.field) return;
          source.jsonData.forEach((item) => {
            if (!item.hasOwnProperty(def.field)) return;
            const nodeValue = item[def.field];
            if (nodeValue !== null && nodeValue !== undefined) {
              const nodeId = `${def.name}_${nodeValue}`;
              if (!nodeValueMap.has(nodeId)) {
                const displayLabel = def.labelField && item[def.labelField] ? item[def.labelField] : nodeValue;
                const nodeProperties = {};
                def.properties.forEach(prop => { if(item.hasOwnProperty(prop)) nodeProperties[prop] = item[prop]; });
                
                // 确保唯一标识字段也被包含在属性中，这对于关系查找很重要
                if (!nodeProperties.hasOwnProperty(def.field)) {
                    nodeProperties[def.field] = item[def.field];
                }
                
                allNodes.push({ id: nodeId, label: String(displayLabel), type: def.name, properties: nodeProperties });
                nodeValueMap.set(nodeId, allNodes[allNodes.length - 1]);
              }
            }
          });
        });
      });

      // FIX #2: Complete and correct relationship generation logic
      const allEdges = [];
      relationshipDefinitions.value.forEach(relDef => {
        if (!relDef.source || !relDef.target || !relDef.type) return;

        // START: 修改的部分
        if (relDef.method === 'field' && relDef.sourceForeignKey && relDef.targetForeignKey) {
            // 使用用户选择的 sourceForeignKey 作为连接键
            const sourceIdentifierField = relDef.sourceForeignKey; 
            
            const sourceNodeMap = new Map();
            allNodes.filter(n => n.type === relDef.source).forEach(sNode => {
                // 确保源节点有这个连接属性
                if (sNode.properties.hasOwnProperty(sourceIdentifierField)) {
                    // 使用连接属性的值作为 Map 的 key
                    sourceNodeMap.set(sNode.properties[sourceIdentifierField], sNode);
                }
            });

            allNodes.filter(n => n.type === relDef.target).forEach(tNode => {
                if (tNode.properties.hasOwnProperty(relDef.targetForeignKey)) {
                    const foreignKeyValue = tNode.properties[relDef.targetForeignKey];
                    if (sourceNodeMap.has(foreignKeyValue)) {
                        const sourceNode = sourceNodeMap.get(foreignKeyValue);
                        if (sourceNode.id !== tNode.id) {
                            allEdges.push({ id: `e_${sourceNode.id}_${tNode.id}_${relDef.type}_${Math.random()}`, source: sourceNode.id, target: tNode.id, label: relDef.type });
                        }
                    }
                }
            });
        // END: 修改的部分
        } else if (relDef.method === 'cross') {
          const sourceNodes = allNodes.filter(n => n.type === relDef.source);
          const targetNodes = allNodes.filter(n => n.type === relDef.target);
          sourceNodes.forEach(sNode => {
            targetNodes.forEach(tNode => {
              if (sNode.id !== tNode.id) {
                allEdges.push({ id: `e_${sNode.id}_${tNode.id}`, source: sNode.id, target: tNode.id, label: relDef.type });
              }
            });
});
        }
      });
      
      graphData.value = { nodes: allNodes, edges: allEdges };

    } catch (error) {
      console.error("生成图谱失败:", error);
      alert(`生成图谱时出错: ${error.message}`);
    } finally {
      isGeneratingGraph.value = false;
    }
  }, 100);
};

const getSourceIdentifier = (nodeTypeName) => {
    const nodeDef = nodeDefinitions.value.find(def => def.name === nodeTypeName);
    return nodeDef ? nodeDef.field : '';
};
</script>

<style>
@import './Structure.scss';
</style>