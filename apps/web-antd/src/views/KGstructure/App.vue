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
        
        <ConfigurationManager
          v-if="dataSources.length > 0"
          :node-definitions="nodeDefinitions"
          :relationship-definitions="relationshipDefinitions"
          @import-config="handleImportConfig"
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
import { ref, computed } from 'vue';
import DataSourceManager from './DataSourceManager.vue';
import NodeDefinitionPanel from './NodeDefinitionPanel.vue';
import RelationshipDefinitionPanel from './RelationshipDefinitionPanel.vue';
import GraphControlPanel from './GraphControlPanel.vue';
import GraphVisualizer from './GraphVisualizer.vue';
import ConfigurationManager from './ConfigurationManager.vue';

// --- State ---
const dataSources = ref([]);
const nodeDefinitions = ref([]);
const relationshipDefinitions = ref([]);
const graphData = ref({ nodes: [], edges: [] });
const isGeneratingGraph = ref(false);
const isProcessingFile = ref(false);

// --- Computed Properties ---
const allAttributeFieldsWithSources = computed(() => {
  const fieldMap = new Map();
  dataSources.value.forEach(source => {
    // 确保 source.attributeFields 存在且是数组
    if (Array.isArray(source.attributeFields)) {
      source.attributeFields.forEach(field => {
        if (!fieldMap.has(field)) {
          fieldMap.set(field, new Set());
        }
        fieldMap.get(field).add(source.name);
      });
    }
  });
  
  const result = [];
  for (const [field, sources] of fieldMap.entries()) {
    result.push({ field, sources: Array.from(sources) });
  }
  return result.sort((a, b) => a.field.localeCompare(b.field));
});


// --- Methods ---

const handleAddNewSource = async (file) => {
  isProcessingFile.value = true;
  const formData = new FormData();
  formData.append('file', file);

  // 统一上传入口，暂时只处理zip，未来后端可扩展
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.zip')) {
      // 在前端进行简单过滤，或者让后端来返回错误信息
      alert("目前只支持上传.zip格式的shp文件压缩包。");
      isProcessingFile.value = false;
      return;
  }
  
  try {
    // 1. 上传文件，获取 taskId
    // 确保这里的路径与你的前端代理配置一致
    const uploadResponse = await fetch('/api/datasource/upload', {
      method: 'POST',
      body: formData,
    });

    if (uploadResponse.status !== 202) { // 期望 202 Accepted
      const errorText = await uploadResponse.text();
      throw new Error(`文件上传失败: ${errorText}`);
    }

    const { taskId, fileName: originalFileName } = await uploadResponse.json();
    console.log(`文件上传成功，任务ID: ${taskId}`);

    // 2. 开始轮询任务状态
    const poll = setInterval(async () => {
      try {
        const statusResponse = await fetch(`/api/datasource/status/${taskId}?fileName=${encodeURIComponent(originalFileName)}`);
        if (!statusResponse.ok) {
           console.error(`查询任务 ${taskId} 状态失败`);
           return;
        }

        const result = await statusResponse.json();
        console.log(`任务 ${taskId} 状态: ${result.status}`);

        if (result.status === 'COMPLETED') {
          clearInterval(poll);
          isProcessingFile.value = false;
          
          const sourceMetadata = result.data;
          
          dataSources.value.push({
            id: Date.now(), // 前端临时ID
            dataSourceId: sourceMetadata.dataSourceId, // 后端的唯一ID
            name: sourceMetadata.name,
            attributeFields: sourceMetadata.attributeFields,
            recordCount: sourceMetadata.recordCount,
          });
          
          if (nodeDefinitions.value.length === 0 && dataSources.value.length > 0) {
            nodeDefinitions.value.push({
                id: Date.now(), name: '', field: '', labelField: '',
                filterField: '', filterValue: '', group: '',
                properties: [], isPropertiesOpen: false, propertySearchTerm: ''
            });
          }

        } else if (result.status === 'FAILED') {
          clearInterval(poll);
          isProcessingFile.value = false;
          alert(`文件处理失败: ${result.error || '未知错误'}`);
        }
        console.log(dataSources.value);
      } catch (pollError) {
        clearInterval(poll);
        isProcessingFile.value = false;
        alert(`查询处理状态时发生错误: ${pollError.message}`);
      }
    }, 3000);

  } catch (error) {
    isProcessingFile.value = false;
    alert(`添加数据源失败: ${error.message}`);
  }
};


const handleImportConfig = (config) => {
  nodeDefinitions.value = config.nodeDefinitions || [];
  relationshipDefinitions.value = config.relationshipDefinitions || [];
  console.log('Configuration has been applied.');
};


const handleRemoveSource = (indexToRemove) => {
  dataSources.value.splice(indexToRemove, 1);
  if (dataSources.value.length === 0) {
      resetDefinitions();
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


// ===================================================================================
// ==================== NEW: generateKG 函数 (调用后端 API) ==========================
// ===================================================================================
const generateKG = async () => {
  if (nodeDefinitions.value.every(def => !def.name || !def.field)) {
    alert("请至少定义一个有效的节点（类型和主键字段不能为空）。");
    return;
  }

  isGeneratingGraph.value = true;
  graphData.value = { nodes: [], edges: [] };

  try {
    // 1. 收集数据源ID
    const dataSourceIds = dataSources.value.map(ds => ds.dataSourceId);
    if (dataSourceIds.length === 0) {
      alert("请先添加数据源。");
      isGeneratingGraph.value = false;
      return;
    }

    // 2. 构建请求体 (图谱构建蓝图)
    const generationRequest = {
      dataSourceIds: dataSourceIds,
      nodeDefinitions: nodeDefinitions.value.map(def => ({
          name: def.name,
          field: def.field,
          labelField: def.labelField,
          filterField: def.filterField,
          filterValue: def.filterValue,
          group: def.group,
          properties: def.properties,
      })),
      relationshipDefinitions: relationshipDefinitions.value.map(def => ({
          method: def.method,
          source: def.source,
          target: def.target,
          type: def.type,
          sourceForeignKey: def.sourceForeignKey,
          targetForeignKey: def.targetForeignKey,
      })),
    };

    // 3. 调用后端API
    const response = await fetch('/api/kg/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(generationRequest),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`生成图谱失败: ${response.statusText} - ${errorBody}`);
    }

    // 4. 获取并设置图谱数据
    const resultGraphData = await response.json();
    
    console.log("从后端接收到的图谱数据:", resultGraphData);
    graphData.value = resultGraphData;
    console.log("图谱渲染完成. 节点数:", resultGraphData.nodes.length, "边数:", resultGraphData.edges.length);

  } catch (error) {
    console.error("生成图谱失败:", error);
    alert(`生成图谱时出错: ${error.message}`);
  } finally {
    isGeneratingGraph.value = false;
  }
};

</script>

<style>
@import './Structure.scss';
</style>