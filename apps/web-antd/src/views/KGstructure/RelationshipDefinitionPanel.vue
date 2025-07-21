<template>
  <div class="card">
    <h2>3. 关系定义</h2>
    <div class="definition-list">
      <div class="definition-item" v-for="(relDef, index) in props.modelValue" :key="relDef.id">
        <div class="inputs">
          <div class="input-row">
            <div>
              <label :for="'rel-source-' + relDef.id">源节点类型</label>
              <select :id="'rel-source-' + relDef.id" :value="relDef.source" @change="updateRelDef(index, 'source', $event.target.value)">
                <option disabled value="">选择源节点</option>
                <option v-for="nodeType in definedNodeTypes" :key="nodeType" :value="nodeType">{{ nodeType }}</option>
              </select>
            </div>
            <div>
              <label :for="'rel-target-' + relDef.id">目标节点类型</label>
              <select :id="'rel-target-' + relDef.id" :value="relDef.target" @change="updateRelDef(index, 'target', $event.target.value)">
                <option disabled value="">选择目标节点</option>
                <option v-for="nodeType in definedNodeTypes" :key="nodeType" :value="nodeType">{{ nodeType }}</option>
              </select>
            </div>
          </div>
          <div class="input-row">
            <!-- ***核心修改1***: 当连接方式为'spatial'时，隐藏关系名称输入框 -->
            <div v-if="relDef.method !== 'spatial'">
              <label :for="'rel-type-' + relDef.id">关系名称</label>
              <input :id="'rel-type-' + relDef.id" type="text" :value="relDef.type" @input="updateRelDef(index, 'type', $event.target.value)" placeholder="例如: 拥有">
            </div>
            <div>
              <label :for="'rel-method-' + relDef.id">连接方式</label>
              <select :id="'rel-method-' + relDef.id" :value="relDef.method" @change="updateRelDef(index, 'method', $event.target.value)">
                <option value="spatial">空间关系 (自动)</option>
                <option value="field">根据字段连接</option>
                <option value="cross">交叉连接 (全部互联)</option>
              </select>
            </div>
          </div>
          <!-- HIDE THIS BLOCK: 仅在连接方式为 'field' 时显示 -->
          <div class="input-row" v-if="relDef.method === 'field'">
            <div>
                <label :for="'rel-source-foreignKey-' + relDef.id">源节点连接字段</label>
                <select :id="'rel-source-foreignKey-' + relDef.id" :value="relDef.sourceForeignKey" @change="updateRelDef(index, 'sourceForeignKey', $event.target.value)">
                    <option disabled value="">选择字段</option>
                    <option v-for="field in getAvailableSourceKeys(relDef)" :key="field" :value="field">{{ field }}</option>
                </select>
            </div>
            <div>
                <label :for="'rel-target-foreignKey-' + relDef.id">目标节点连接字段</label>
                <select :id="'rel-target-foreignKey-' + relDef.id" :value="relDef.targetForeignKey" @change="updateRelDef(index, 'targetForeignKey', $event.target.value)">
                    <option disabled value="">选择字段</option>
                    <option v-for="field in getAvailableTargetKeys(relDef)" :key="field" :value="field">{{ field }}</option>
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
</template>

<script setup>
import { watch, computed, defineProps, defineEmits } from 'vue';

const props = defineProps({
  attributeFields: { type: Array, required: true },
  nodeDefinitions: { type: Array, required: true },
  modelValue: { type: Array, required: true }
});

const emit = defineEmits(['update:modelValue']);

const definedNodeTypes = computed(() => 
    props.nodeDefinitions.map(def => def.name).filter(Boolean)
);

const getAvailableKeysForNode = (nodeTypeName) => {
    if (!nodeTypeName) return [];
    const nodeDef = props.nodeDefinitions.find(def => def.name === nodeTypeName);
    if (!nodeDef) return [];
    const availableKeys = new Set();
    if (nodeDef.field) availableKeys.add(nodeDef.field);
    nodeDef.properties.forEach(prop => availableKeys.add(prop));
    return Array.from(availableKeys);
}

const getAvailableSourceKeys = (relDef) => getAvailableKeysForNode(relDef.source);
const getAvailableTargetKeys = (relDef) => getAvailableKeysForNode(relDef.target);

const addRelationshipDefinition = () => {
  const newRelDef = {
    id: Date.now(), source: '', target: '', type: '', 
    // NEW: 默认连接方式改为 spatial
    method: 'spatial', 
    sourceForeignKey: '', targetForeignKey: ''
  };
  emit('update:modelValue', [...props.modelValue, newRelDef]);
};

const removeRelationshipDefinition = (index) => {
  const newDefs = props.modelValue.filter((_, i) => i !== index);
  emit('update:modelValue', newDefs);
};

const updateRelDef = (index, key, value) => {
  const newDefs = JSON.parse(JSON.stringify(props.modelValue));
  const relToUpdate = newDefs[index];
  
  if (key === 'source') {
    relToUpdate.sourceForeignKey = '';
  }
  if (key === 'target') {
    relToUpdate.targetForeignKey = '';
  }
  
  relToUpdate[key] = value;
  
  emit('update:modelValue', newDefs);
};

watch(() => props.nodeDefinitions, (newNodeDefs) => {
  if (props.modelValue.length === 0) return;

  const nodeDefsMap = new Map(newNodeDefs.map(def => [def.name, def]));
  let hasChanged = false;
  const newRelDefs = JSON.parse(JSON.stringify(props.modelValue));

  newRelDefs.forEach(relDef => {
    if (relDef.source && !nodeDefsMap.has(relDef.source)) {
        relDef.source = '';
        relDef.sourceForeignKey = '';
        hasChanged = true;
    } else if (relDef.source) {
        const validKeys = getAvailableKeysForNode(relDef.source);
        if (relDef.sourceForeignKey && !validKeys.includes(relDef.sourceForeignKey)) {
            relDef.sourceForeignKey = '';
            hasChanged = true;
        }
    }
    
    if (relDef.target && !nodeDefsMap.has(relDef.target)) {
        relDef.target = '';
        relDef.targetForeignKey = '';
        hasChanged = true;
    } else if (relDef.target) {
        const validKeys = getAvailableKeysForNode(relDef.target);
        if (relDef.targetForeignKey && !validKeys.includes(relDef.targetForeignKey)) {
            relDef.targetForeignKey = '';
            hasChanged = true;
        }
    }
  });

  if (hasChanged) {
    emit('update:modelValue', newRelDefs);
  }
}, { deep: true });
</script>

<style scoped>
/* 样式无需改变 */
</style>