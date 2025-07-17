<template>
  <div class="card">
    <h2>3. 关系定义</h2>
    <div class="definition-list">
      <div class="definition-item" v-for="(relDef, index) in localRelationshipDefinitions" :key="relDef.id">
        <div class="inputs">
          <div class="input-row">
            <div>
              <label :for="'rel-source-' + relDef.id">源节点类型</label>
              <select :id="'rel-source-' + relDef.id" v-model="relDef.source">
                <option disabled value="">选择源节点</option>
                <option v-for="nodeType in definedNodeTypes" :key="nodeType" :value="nodeType">{{ nodeType }}</option>
              </select>
            </div>
            <div>
              <label :for="'rel-target-' + relDef.id">目标节点类型</label>
              <select :id="'rel-target-' + relDef.id" v-model="relDef.target">
                <option disabled value="">选择目标节点</option>
                <option v-for="nodeType in definedNodeTypes" :key="nodeType" :value="nodeType">{{ nodeType }}</option>
              </select>
            </div>
          </div>
          <div class="input-row">
            <div>
              <label :for="'rel-type-' + relDef.id">关系名称</label>
              <input :id="'rel-type-' + relDef.id" type="text" v-model="relDef.type" placeholder="例如: 拥有">
            </div>
            <div>
              <label :for="'rel-method-' + relDef.id">连接方式</label>
              <select :id="'rel-method-' + relDef.id" v-model="relDef.method">
                <option value="cross">交叉连接(全部互联)</option>
                <option value="field">根据字段连接</option>
              </select>
            </div>
          </div>
          <div class="input-row" v-if="relDef.method === 'field'">
            <div>
                <label :for="'rel-source-foreignKey-' + relDef.id">源节点连接字段</label>
                <select :id="'rel-source-foreignKey-' + relDef.id" v-model="relDef.sourceForeignKey">
                    <option disabled value="">选择字段</option>
                    <option v-for="field in getAvailableSourceKeys(relDef)" :key="field" :value="field">{{ field }}</option>
                </select>
            </div>
            <div>
              <label :for="'rel-target-foreignKey-' + relDef.id">目标节点连接字段</label>
              <select :id="'rel-target-foreignKey-' + relDef.id" v-model="relDef.targetForeignKey">
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
import { ref, watch, computed, defineProps, defineEmits } from 'vue';

const props = defineProps({
  attributeFields: { type: Array, required: true },
  nodeDefinitions: { type: Array, required: true },
  modelValue: { type: Array, required: true }
});

const emit = defineEmits(['update:modelValue']);

const localRelationshipDefinitions = ref(JSON.parse(JSON.stringify(props.modelValue)));

const definedNodeTypes = computed(() => 
    props.nodeDefinitions.map(def => def.name).filter(Boolean)
);

const getAvailableKeysForNode = (nodeTypeName) => {
    if (!nodeTypeName) return [];
    const nodeDef = props.nodeDefinitions.find(def => def.name === nodeTypeName);
    if (!nodeDef) return [];
    
    // 可用字段是节点的唯一标识符 + 其所有已选属性
    const availableKeys = new Set();
    if (nodeDef.field) availableKeys.add(nodeDef.field);
    nodeDef.properties.forEach(prop => availableKeys.add(prop));
    
    return Array.from(availableKeys);
}

const getAvailableSourceKeys = (relDef) => getAvailableKeysForNode(relDef.source);
const getAvailableTargetKeys = (relDef) => getAvailableKeysForNode(relDef.target);


watch(() => props.modelValue, (newValue) => {
    localRelationshipDefinitions.value = JSON.parse(JSON.stringify(newValue));
}, { deep: true });

watch(localRelationshipDefinitions, (newValue) => {
  emit('update:modelValue', newValue);
}, { deep: true });

// START: 替换为更全面的修复方案
watch(() => props.nodeDefinitions, (newNodeDefs) => {
    // 创建一个从节点名称到节点定义的映射，方便快速查找
    const nodeDefsMap = new Map(newNodeDefs.map(def => [def.name, def]));

    localRelationshipDefinitions.value.forEach(relDef => {
        // --- 检查源节点 ---
        const sourceDef = nodeDefsMap.get(relDef.source);
        if (!sourceDef) {
            // 如果源节点类型不存在了（被删除或重命名），则完全重置
            relDef.source = '';
            relDef.sourceForeignKey = '';
        } else {
            // 如果源节点类型还存在，检查其连接字段是否仍然有效
            const validSourceKeys = getAvailableKeysForNode(relDef.source);
            if (relDef.sourceForeignKey && !validSourceKeys.includes(relDef.sourceForeignKey)) {
                // 连接字段失效（例如，该属性从节点定义中被移除了），则重置连接字段
                relDef.sourceForeignKey = '';
            }
        }

        // --- 检查目标节点（逻辑同上） ---
        const targetDef = nodeDefsMap.get(relDef.target);
        if (!targetDef) {
            relDef.target = '';
            relDef.targetForeignKey = '';
        } else {
            const validTargetKeys = getAvailableKeysForNode(relDef.target);
            if (relDef.targetForeignKey && !validTargetKeys.includes(relDef.targetForeignKey)) {
                relDef.targetForeignKey = '';
            }
        }
    });
}, { deep: true });
// END: 替换为更全面的修复方案


const addRelationshipDefinition = () => {
  localRelationshipDefinitions.value.push({
    id: Date.now(), 
    source: '', 
    target: '', 
    type: '', 
    method: 'cross', 
    sourceForeignKey: '',
    targetForeignKey: ''
  });
};

const removeRelationshipDefinition = (index) => {
  localRelationshipDefinitions.value.splice(index, 1);
};
</script>

<style scoped>
/* 样式保持不变 */
</style>