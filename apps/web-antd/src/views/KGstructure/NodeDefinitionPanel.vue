<template>
  <div class="card">
    <h2>2. 节点定义</h2>
    <div class="definition-list">
      <div class="definition-item" v-for="(nodeDef, index) in localNodeDefinitions" :key="nodeDef.id">
        <div class="inputs">
            <div class="input-row">
                <div>
                    <label :for="'node-name-' + nodeDef.id">节点类型</label>
                    <input :id="'node-name-' + nodeDef.id" type="text" v-model="nodeDef.name" placeholder="例如: 旱地">
                </div>
                <div>
                    <label :for="'node-group-' + nodeDef.id">节点分组 (可选)</label>
                    <input :id="'node-group-' + nodeDef.id" type="text" v-model="nodeDef.group" placeholder="例如: 地块">
                </div>
            </div>
             <div class="input-row">
                <div>
                    <label :for="'node-field-' + nodeDef.id">唯一标识字段</label>
                    <select :id="'node-field-' + nodeDef.id" v-model="nodeDef.field">
                        <option disabled value="">请选择字段</option>
                        <!-- MODIFIED: Added source info -->
                        <option v-for="attr in attributeFields" :key="attr.field + attr.sources.join()" :value="attr.field">
                          {{ attr.field }} (来源: {{ attr.sources.join(', ') }})
                        </option>
                    </select>
                </div>
                <div>
                    <label :for="'node-label-field-' + nodeDef.id">节点显示名称</label>
                    <select :id="'node-label-field-' + nodeDef.id" v-model="nodeDef.labelField">
                        <option value="">-- 使用唯一标识 --</option>
                        <!-- MODIFIED: Added source info -->
                        <option v-for="attr in attributeFields" :key="attr.field + attr.sources.join()" :value="attr.field">
                          {{ attr.field }} (来源: {{ attr.sources.join(', ') }})
                        </option>
                    </select>
                </div>
            </div>

            <div class="input-row">
                <div>
                    <label :for="'filter-field-' + nodeDef.id">过滤字段 (可选)</label>
                    <select :id="'filter-field-' + nodeDef.id" v-model="nodeDef.filterField">
                        <option value="">选择过滤字段</option>
                        <!-- MODIFIED: Added source info -->
                        <option v-for="attr in attributeFields" :key="attr.field + attr.sources.join()" :value="attr.field">
                          {{ attr.field }} (来源: {{ attr.sources.join(', ') }})
                        </option>
                    </select>
                </div>
                <div>
                    <label :for="'filter-value-' + nodeDef.id">过滤值</label>
                    <input :id="'filter-value-' + nodeDef.id" type="text" v-model="nodeDef.filterValue" placeholder="输入字段值" :disabled="!nodeDef.filterField">
                </div>
            </div>
            
            <div class="input-row">
                <div class="property-selection">
                    <label>节点属性 (可选)</label>
                    <!-- MODIFIED: Structure and class for alignment -->
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
                            <div v-for="(item, itemIndex) in getFilteredFields(nodeDef)" :key="item.text + itemIndex">
                                <div v-if="item.type === 'header'" class="group-title">
                                    <em>{{ item.text }}</em>
                                </div>
                                <div v-if="item.type === 'field'" class="checkbox-item">
                                    <input type="checkbox" 
                                        :id="'prop-' + nodeDef.id + '-' + item.text" 
                                        :value="item.text" 
                                        :checked="nodeDef.properties.includes(item.text)" 
                                        :disabled="item.text === nodeDef.field"
                                        @change="toggleProperty(nodeDef, item.text)">
                                    <label :for="'prop-' + nodeDef.id + '-' + item.text">
                                        {{ item.text }}
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <button class="btn small danger delete-btn" @click="removeNodeDefinition(index)">删除</button>
      </div>
    </div>
    <button class="btn btn-add" @click="addNodeDefinition">
      + 添加节点类型
    </button>
  </div>
</template>

<script setup>
import { ref, watch, defineProps, defineEmits, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  attributeFields: { type: Array, required: true },
  modelValue: { type: Array, required: true }
});

const emit = defineEmits(['update:modelValue']);

const localNodeDefinitions = ref(JSON.parse(JSON.stringify(props.modelValue)));

watch(() => props.modelValue, (newValue) => {
    localNodeDefinitions.value = JSON.parse(JSON.stringify(newValue));
}, { deep: true });

watch(localNodeDefinitions, (newDefs) => {
    newDefs.forEach(def => {
        if (def.field && def.properties.includes(def.field)) {
            def.properties = def.properties.filter(p => p !== def.field);
        }
    });
    emit('update:modelValue', newDefs);
}, { deep: true });


const addNodeDefinition = () => {
  localNodeDefinitions.value.push({
    id: Date.now(), name: '', field: '', labelField: '',
    filterField: '', filterValue: '', group: '',
    properties: [], isPropertiesOpen: false, propertySearchTerm: ''
  });
};

const removeNodeDefinition = (index) => {
  localNodeDefinitions.value.splice(index, 1);
};

const togglePropertiesDropdown = (nodeDef) => {
    localNodeDefinitions.value.forEach(def => {
        if (def.id !== nodeDef.id) def.isPropertiesOpen = false;
    });
    nodeDef.isPropertiesOpen = !nodeDef.isPropertiesOpen;
};

const closeAllDropdowns = () => {
    localNodeDefinitions.value.forEach(def => def.isPropertiesOpen = false);
};

const getFilteredFields = (nodeDef) => {
    const searchTerm = nodeDef.propertySearchTerm.toLowerCase();
    
    const filteredAttributes = props.attributeFields.filter(attr => 
        attr.field.toLowerCase().includes(searchTerm)
    );

    const sourceMap = new Map();
    filteredAttributes.forEach(attr => {
        attr.sources.forEach(sourceName => {
            if (!sourceMap.has(sourceName)) {
                sourceMap.set(sourceName, new Set());
            }
            sourceMap.get(sourceName).add(attr.field);
        });
    });

    const groupedFields = Array.from(sourceMap.entries())
        .map(([sourceName, fieldsSet]) => ({
            sourceName,
            fields: Array.from(fieldsSet).sort()
        }))
        .sort((a, b) => a.sourceName.localeCompare(b.sourceName));

    const renderList = [];
    groupedFields.forEach(group => {
        renderList.push({ type: 'header', text: `来自 ${group.sourceName}` });
        group.fields.forEach(field => {
            renderList.push({ type: 'field', text: field });
        });
    });

    return renderList;
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
    nodeDef.properties = props.attributeFields
        .map(attr => attr.field)
        .filter(f => f !== nodeDef.field);
};

const deselectAllProperties = (nodeDef) => {
    nodeDef.properties = [];
};

onMounted(() => window.addEventListener('click', closeAllDropdowns));
onUnmounted(() => window.removeEventListener('click', closeAllDropdowns));
</script>

<style scoped>
.property-selection {
  width: 100%;
}

/* MODIFIED: Use flexbox for alignment */
.multi-select-trigger {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    /* Assuming base styles for inputs are defined globally to match other inputs */
    text-align: left;
    position: relative;
    /* Add padding to look like an input */
    padding: 8px 12px; 
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: white;
    cursor: pointer;
}

.group-title {
  padding: 6px 10px;
  color: #555;
  font-size: 0.9em;
  font-style: italic;
  margin-top: 8px;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dropdown-options > div:first-child > .group-title {
  margin-top: 0;
}
</style>