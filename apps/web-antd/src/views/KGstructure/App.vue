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
  return result.sort((a, b) => a.field.localeCompare(b.field));
});


// --- Methods ---
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
    alert("不支持的文件类型。请上传 .zip, .json, 或 .geojson 文件。");
    onComplete(false);
  }
};


const handleImportConfig = (config) => {
  nodeDefinitions.value = config.nodeDefinitions || [];
  relationshipDefinitions.value = config.relationshipDefinitions || [];
  console.log('Configuration has been applied.');
};


const handleRemoveSource = (indexToRemove) => {
  dataSources.value = dataSources.value.filter((_, index) => index !== indexToRemove);
  if (dataSources.value.length === 0) {
      resetDefinitions();
  }
};

const addDataSourceToList = (sourceData) => {
    const firstRecordAttributes = sourceData.features[0]?.attributes || {};
    
    dataSources.value.push({
        id: Date.now(),
        name: sourceData.name,
        features: sourceData.features,
        spatialRelationships: sourceData.spatialRelationships || [],
        attributeFields: Object.keys(firstRecordAttributes),
        recordCount: sourceData.features.length
    });

    if (nodeDefinitions.value.length === 0 && sourceData.features.length > 0) {
        nodeDefinitions.value.push({
            id: Date.now(), name: '', field: '', labelField: '',
            // NEW: Initialize new properties
            filterField: '', filterValue: '', group: '',
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
            let featuresRaw = [];
            if (Array.isArray(parsedData)) featuresRaw = parsedData;
            else if (parsedData.type === 'FeatureCollection') featuresRaw = parsedData.features.map(f => f.properties);
            
            const features = featuresRaw.map((attrs, index) => ({
                featureId: `${file.name}_${index}`,
                attributes: attrs
            }));

            addDataSourceToList({
                name: file.name,
                features: features,
                spatialRelationships: []
            });
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
            if (!statusRes.ok) throw new Error(`获取状态失败: ${statusRes.statusText}`);
            const { status, error } = await statusRes.json();

            if (status === 'COMPLETED') {
                clearInterval(poll);
                const dataRes = await fetch(`/api/files/data/${taskId}`);
                if (!dataRes.ok) throw new Error(`获取数据失败: ${dataRes.statusText}`);
                const backendResult = await dataRes.json();
                
                if (!backendResult || !Array.isArray(backendResult.features)) {
                  throw new Error("从后端接收到的数据格式无效。");
                }
                
                const featuresWithGlobalIds = backendResult.features.map(feature => ({
                    ...feature,
                    featureId: `${file.name}_${feature.featureId}` 
                }));

                const spatialRelsWithGlobalIds = (backendResult.spatialRelationships || []).map(rel => ({
                    ...rel,
                    sourceFeatureId: `${file.name}_${rel.sourceFeatureId}`,
                    targetFeatureId: `${file.name}_${rel.targetFeatureId}`
                }));

                addDataSourceToList({
                  name: file.name,
                  features: featuresWithGlobalIds,
                  spatialRelationships: spatialRelsWithGlobalIds
                });
                onComplete(true);

            } else if (status === 'FAILED') {
                clearInterval(poll);
                throw new Error(error || '后端解析失败');
            }
        }, 2000);
    } catch (error) {
        if(poll) clearInterval(poll);
        alert(`处理ZIP文件失败: ${error.message}`);
        onComplete(false);
    }
};


// ===================================================================================
// ==================== generateKG 函数 (已适配过滤和分组) ==========================
// ===================================================================================
const generateKG = () => {
  isGeneratingGraph.value = true;
  graphData.value = { nodes: [], edges: [] };

  setTimeout(() => {
    try {
      const nodeMapById = new Map(); 

      // --- 步骤 1: 节点生成 (集成过滤条件) ---
      dataSources.value.forEach(source => {
        source.features.forEach((feature) => {
          nodeDefinitions.value.forEach(def => {
            if (!def.name || !def.field) return;
            
            const item = feature.attributes;
            if (!item.hasOwnProperty(def.field)) return;

            // *** NEW: 应用行过滤条件 ***
            if (def.filterField && def.filterValue) {
              if (String(item[def.filterField]).trim() !== String(def.filterValue).trim()) {
                return; // 如果不满足过滤条件，则跳过此行对此节点定义的处理
              }
            }
            
            const nodeValue = item[def.field];
            if (nodeValue !== null && nodeValue !== undefined && nodeValue !== '') {
              const nodeId = `${def.name}_${nodeValue}`; 

              if (!nodeMapById.has(nodeId)) {
                const displayLabel = def.labelField && item[def.labelField] ? item[def.labelField] : nodeValue;
                const nodeProperties = {};
                
                def.properties.forEach(prop => { 
                  if(item.hasOwnProperty(prop)) nodeProperties[prop] = item[prop]; 
                });
                
                nodeProperties.featureIds = [feature.featureId];

                if (!nodeProperties.hasOwnProperty(def.field)) {
                    nodeProperties[def.field] = item[def.field];
                }
                
                const newNode = { 
                  id: nodeId, 
                  label: String(displayLabel), 
                  type: def.name,
                  // *** NEW: 添加分组信息 ***
                  group: def.group || null,
                  properties: nodeProperties 
                };
                nodeMapById.set(nodeId, newNode);
              } else {
                const existingNode = nodeMapById.get(nodeId);
                existingNode.properties.featureIds.push(feature.featureId);
                
                def.properties.forEach(prop => {
                  if (!existingNode.properties.hasOwnProperty(prop) && item.hasOwnProperty(prop)) {
                    existingNode.properties[prop] = item[prop];
                  }
                });

                if (def.labelField && item[def.labelField]) {
                    const oldLabelIsDefault = String(existingNode.label) === String(existingNode.properties[def.field]);
                    if (oldLabelIsDefault) {
                        existingNode.label = String(item[def.labelField]);
                    }
                }
              }
            }
          });
        });
      });

      const allNodes = Array.from(nodeMapById.values());
      let allEdges = [];

      // --- 步骤 2: 关系生成 (适配分组) ---

      // --- 步骤 2a: 处理空间关系 ---
      const nodesByFeatureId = new Map();
      allNodes.forEach(node => {
        if (node.properties.featureIds && Array.isArray(node.properties.featureIds)) {
          node.properties.featureIds.forEach(fid => {
            if (!nodesByFeatureId.has(fid)) {
              nodesByFeatureId.set(fid, []);
            }
            nodesByFeatureId.get(fid).push(node);
          });
        }
      });
      
      const spatialRules = relationshipDefinitions.value.filter(def => def.method === 'spatial' && def.source && def.target);
      const spatialRelationMap = { 'TOUCHES': '邻接', 'OVERLAPS': '重叠', 'CONTAINS': '包含', 'WITHIN': '在...之内', 'INTERSECTS': '相交', 'EQUALS': '空间相等', 'DISJOINT': '相离', 'CROSSES': '穿越' };

      if (spatialRules.length > 0) {
        dataSources.value.forEach(source => {
          if (!source.spatialRelationships || source.spatialRelationships.length === 0) return;
          source.spatialRelationships.forEach(rel => {
            const sourceNodesInFeature = nodesByFeatureId.get(rel.sourceFeatureId) || [];
            const targetNodesInFeature = nodesByFeatureId.get(rel.targetFeatureId) || [];

            if (sourceNodesInFeature.length > 0 && targetNodesInFeature.length > 0) {
              for (const rule of spatialRules) {
                // *** NEW: 查找匹配规则的节点 (包括检查分组) ***
                const findNode = (nodes, typeOrGroup) => nodes.find(n => n.type === typeOrGroup || n.group === typeOrGroup);
                
                // 正向匹配
                let sourceNode = findNode(sourceNodesInFeature, rule.source);
                let targetNode = findNode(targetNodesInFeature, rule.target);

                if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
                    const edgeLabel = spatialRelationMap[rel.type.toUpperCase()] || rel.type;
                    allEdges.push({
                      id: `e_spatial_${sourceNode.id}_${targetNode.id}_${rel.type}`,
                      source: sourceNode.id, target: targetNode.id, label: edgeLabel
                    });
                    continue; // 处理下一条空间关系
                }

                // 反向匹配
                sourceNode = findNode(sourceNodesInFeature, rule.target);
                targetNode = findNode(targetNodesInFeature, rule.source);

                if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
                    const edgeLabel = spatialRelationMap[rel.type.toUpperCase()] || rel.type;
                    allEdges.push({
                      id: `e_spatial_${sourceNode.id}_${targetNode.id}_${rel.type}`,
                      source: sourceNode.id, target: targetNode.id, label: edgeLabel
                    });
                }
              }
            }
          });
        });
      }

      // --- 步骤 2b: 处理字段连接关系 ---
      const fieldRules = relationshipDefinitions.value.filter(def => def.method === 'field' && def.source && def.target && def.sourceForeignKey && def.targetForeignKey);
      fieldRules.forEach(rule => {
        // *** NEW: 根据类型或分组来过滤节点 ***
        const sourceNodes = allNodes.filter(n => n.type === rule.source || n.group === rule.source);
        const targetNodes = allNodes.filter(n => n.type === rule.target || n.group === rule.target);
        
        const sourceNodeMapByFK = new Map();
        sourceNodes.forEach(sNode => {
            const key = sNode.properties[rule.sourceForeignKey];
            if (key !== undefined && key !== null) {
                if (!sourceNodeMapByFK.has(key)) sourceNodeMapByFK.set(key, []);
                sourceNodeMapByFK.get(key).push(sNode);
            }
        });
        if (sourceNodeMapByFK.size === 0) return;

        targetNodes.forEach(tNode => {
            const key = tNode.properties[rule.targetForeignKey];
            if (sourceNodeMapByFK.has(key)) {
                sourceNodeMapByFK.get(key).forEach(sNode => {
                    if (sNode.id !== tNode.id) {
                         allEdges.push({ 
                             id: `e_field_${sNode.id}_${tNode.id}_${rule.type}`, 
                             source: sNode.id, 
                             target: tNode.id, 
                             label: rule.type 
                         });
                    }
                });
            }
        });
      });

      // --- 步骤 3: 更新图谱数据 ---
      const uniqueEdges = Array.from(new Map(allEdges.map(edge => {
          // 为防止双向关系重复，对source和target排序
          const key = [edge.source, edge.target].sort().join('-') + `-${edge.label}`;
          return [key, edge];
      })).values());

      console.log("即将渲染的节点数据:", allNodes);
      graphData.value = { nodes: allNodes, edges: uniqueEdges };
      console.log("图谱生成完成. 节点数:", allNodes.length, "边数:", uniqueEdges.length);

    } catch (error) {
      console.error("生成图谱失败:", error);
      alert(`生成图谱时出错: ${error.message}`);
    } finally {
      isGeneratingGraph.value = false;
    }
  }, 100);
};

</script>

<style>
@import './Structure.scss';
</style>