<template>
  <div class="card">
    <h2>2. 节点定义</h2>
    <div class="definition-list">
      <div class="definition-item" v-for="(nodeDef, index) in localNodeDefinitions" :key="nodeDef.id">
        <div class="inputs">
            <div class="input-row">
                <div>
                    <label :for="'node-name-' + nodeDef.id">节点类型</label>
                    <input :id="'node-name-' + nodeDef.id" type="text" v-model="nodeDef.name" placeholder="例如: 地块">
                </div>
                <div>
                    <label :for="'node-field-' + nodeDef.id">唯一标识字段</label>
                    <select :id="'node-field-' + nodeDef.id" v-model="nodeDef.field">
                        <option disabled value="">请选择字段</option>
                        <option v-for="attr in attributeFields" :key="attr.field" :value="attr.field">
                          {{ attr.field }} (来源: {{ attr.sources.join(', ') }})
                        </option>
                    </select>
                </div>
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
                    <!-- START: 修改的部分 -->
                    <div class="dropdown-options">
                        <div v-for="(item, itemIndex) in getFilteredFields(nodeDef)" :key="item.text + itemIndex">
                            <!-- 渲染分组标题行 -->
                            <div v-if="item.type === 'header'" class="group-title">
                                <em>{{ item.text }}</em>
                            </div>
                            <!-- 渲染字段复选框行 -->
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
                    <!-- END: 修改的部分 -->
                </div>
            </div>

             <div class="input-row">
                <div>
                    <label :for="'node-label-field-' + nodeDef.id">节点显示名称</label>
                    <select :id="'node-label-field-' + nodeDef.id" v-model="nodeDef.labelField">
                        <option value="">-- 使用唯一标识 --</option>
                        <option v-for="attr in attributeFields" :key="attr.field" :value="attr.field">
                          {{ attr.field }} (来源: {{ attr.sources.join(', ') }})
                        </option>
                    </select>
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

// START: 修改的函数
/**
 * 根据搜索词过滤属性，并返回一个用于渲染的扁平化列表，其中包含标题和字段。
 * @param {object} nodeDef - 当前的节点定义对象.
 * @returns {Array<{type: 'header'|'field', text: string}>} - 扁平化的列表.
 */
const getFilteredFields = (nodeDef) => {
    const searchTerm = nodeDef.propertySearchTerm.toLowerCase();
    
    // 1. 先根据搜索词过滤出所有匹配的字段
    const filteredAttributes = props.attributeFields.filter(attr => 
        attr.field.toLowerCase().includes(searchTerm)
    );

    // 2. 将过滤后的字段按来源文件进行分组
    const sourceMap = new Map();
    filteredAttributes.forEach(attr => {
        attr.sources.forEach(sourceName => {
            if (!sourceMap.has(sourceName)) {
                sourceMap.set(sourceName, new Set());
            }
            sourceMap.get(sourceName).add(attr.field);
        });
    });

    // 3. 将 Map 转换为按文件名排序的数组
    const groupedFields = Array.from(sourceMap.entries())
        .map(([sourceName, fieldsSet]) => ({
            sourceName,
            fields: Array.from(fieldsSet).sort()
        }))
        .sort((a, b) => a.sourceName.localeCompare(b.sourceName));

    // 4. 将分组数据扁平化为带类型的渲染列表
    const renderList = [];
    groupedFields.forEach(group => {
        renderList.push({ type: 'header', text: `来自 ${group.sourceName}` });
        group.fields.forEach(field => {
            renderList.push({ type: 'field', text: field });
        });
    });

    return renderList;
};
// END: 修改的函数

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
/* START: 添加和修改的样式 */
.group-title {
  padding: 6px 10px; /* 调整padding使其与checkbox-item对齐 */
  color: #555; /* 标题颜色 */
  font-size: 0.9em;
  font-style: italic; /* 斜体 */
  margin-top: 8px; /* 与上一组的间距 */
  pointer-events: none; /* 不可点击 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 确保第一个标题没有顶部外边距 */
.dropdown-options > div:first-child > .group-title {
  margin-top: 0;
}

/* 旧的 .property-group 和 .group-header 样式可以删除了 */
/* END: 添加和修改的样式 */
</style>