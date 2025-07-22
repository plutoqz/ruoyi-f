<template>
  <div class="card">
    <h2>3. 关系定义</h2>
    <div class="definition-list">
      <div class="definition-item" v-for="(relDef, index) in props.modelValue" :key="relDef.id">
        <div class="inputs">
          <div class="input-row">
            <div>
              <label :for="'rel-source-' + relDef.id">源节点类型/分组</label>
              <!-- NEW: Use allAvailableTypes -->
              <select :id="'rel-source-' + relDef.id" :value="relDef.source" @change="updateRelDef(index, 'source', $event.target.value)">
                <option disabled value="">选择源</option>
                <option v-for="item in allAvailableTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </div>
            <div>
              <label :for="'rel-target-' + relDef.id">目标节点类型/分组</label>
              <!-- NEW: Use allAvailableTypes -->
              <select :id="'rel-target-' + relDef.id" :value="relDef.target" @change="updateRelDef(index, 'target', $event.target.value)">
                <option disabled value="">选择目标</option>
                <option v-for="item in allAvailableTypes" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </div>
          </div>
          <div class="input-row">
            <div v-if="relDef.method !== 'spatial'">
              <label :for="'rel-type-' + relDef.id">关系名称</label>
              <input :id="'rel-type-' + relDef.id" type="text" :value="relDef.type" @input="updateRelDef(index, 'type', $event.target.value)" placeholder="例如: 拥有">
            </div>
            <div>
              <label :for="'rel-method-' + relDef.id">连接方式</label>
              <select :id="'rel-method-' + relDef.id" :value="relDef.method" @change="updateRelDef(index, 'method', $event.target.value)">
                <option value="spatial">空间关系 (自动)</option>
                <option value="field">根据字段连接</option>
              </select>
            </div>
          </div>
          <div class="input-row" v-if="relDef.method === 'field'">
            <div>
                <label :for="'rel-source-foreignKey-' + relDef.id">源节点连接字段</label>
                <select :id="'rel-source-foreignKey-' + relDef.id" :value="relDef.sourceForeignKey" @change="updateRelDef(index, 'sourceForeignKey', $event.target.value)">
                    <option disabled value="">选择字段</option>
                    <option v-for="field in getAvailableKeysForNode(relDef.source)" :key="field" :value="field">{{ field }}</option>
                </select>
            </div>
            <div>
                <label :for="'rel-target-foreignKey-' + relDef.id">目标节点连接字段</label>
                <select :id="'rel-target-foreignKey-' + relDef.id" :value="relDef.targetForeignKey" @change="updateRelDef(index, 'targetForeignKey', $event.target.value)">
                    <option disabled value="">选择字段</option>
                    <option v-for="field in getAvailableKeysForNode(relDef.target)" :key="field" :value="field">{{ field }}</option>
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
import { computed, defineProps, defineEmits } from 'vue';

const props = defineProps({
  attributeFields: { type: Array, required: true },
  nodeDefinitions: { type: Array, required: true },
  modelValue: { type: Array, required: true }
});

const emit = defineEmits(['update:modelValue']);

// NEW: Create a list of all available types and groups for dropdowns
const allAvailableTypes = computed(() => {
    const types = new Set();
    const groups = new Set();
    props.nodeDefinitions.forEach(def => {
        if (def.name) types.add(def.name);
        if (def.group) groups.add(def.group);
    });

    const result = [];
    Array.from(types).sort().forEach(t => result.push({label: `类型: ${t}`, value: t}));
    Array.from(groups).sort().forEach(g => result.push({label: `分组: ${g}`, value: g}));
    
    return result;
});

// NEW: Updated to handle groups
const getAvailableKeysForNode = (typeOrGroup) => {
    if (!typeOrGroup) return [];
    
    // Find all node definitions that match the type or group
    const matchingDefs = props.nodeDefinitions.filter(def => def.name === typeOrGroup || def.group === typeOrGroup);
    if (matchingDefs.length === 0) return [];

    // Collect all unique keys from all matching definitions
    const availableKeys = new Set();
    matchingDefs.forEach(def => {
        if (def.field) availableKeys.add(def.field);
        def.properties.forEach(prop => availableKeys.add(prop));
    });

    return Array.from(availableKeys).sort();
}

const addRelationshipDefinition = () => {
  const newRelDef = {
    id: Date.now(), source: '', target: '', type: '', 
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

</script>

<style scoped>
/* Scoped styles can be added here if needed */
</style>