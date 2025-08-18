<template>
  <div v-if="loading" class="loading-container"><a-spin tip="加载中..." /></div>
  <div v-else-if="documents.length === 0" class="loading-container">
    <a-empty description="知识库中没有找到文档" />
  </div>
  <div v-else class="kb-viewer">
    <a-list class="doc-list" bordered :data-source="documents">
      <!-- 只改这一处 template -->
      <template #renderItem="{ item, index }">
        <a-list-item
          @click="selectDocument(item)"
          :class="{ active: selectedDoc && selectedDoc.id === item.id }"
        >
          <!-- 2. 把序号拼到文件名前面 -->
          {{ index + 1 }}. {{ item.filename }}
        </a-list-item>
      </template>
    </a-list>
    <div class="doc-content">
      <pre v-if="selectedDoc">{{ selectedDoc.content }}</pre>
      <a-empty v-else description="请从左侧选择一个文档查看" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { List, Spin, Empty } from 'ant-design-vue';
import { getKnowledgeDocuments } from './rag';

const AList = List;
const AListItem = List.Item;

interface Document {
  id: string;
  filename: string;
  content: string;
}

const loading = ref(true);
const documents = ref<Document[]>([]);
const selectedDoc = ref<Document | null>(null);

onMounted(async () => {
  try {
    const docs = await getKnowledgeDocuments();
    documents.value = docs; // 先赋值给 ref

    // 从数组中获取第一个元素
    const firstDoc = docs[0]; 

    // 对获取到的元素进行检查
    if (firstDoc) { 
      // 在这个 if 块内部，TypeScript 确信 firstDoc 是 Document 类型
      selectedDoc.value = firstDoc;
    }
  } catch (error) {
    console.error("加载知识库文档失败", error);
  } finally {
    loading.value = false;
  }
});

const selectDocument = (doc: Document) => {
  selectedDoc.value = doc;
};
</script>

<style scoped>
.loading-container { display: flex; justify-content: center; align-items: center; height: 100%; min-height: 200px; }
.kb-viewer { display: flex; height: 60vh; }
.doc-list { width: 300px; /* 可以适当加宽列表 */ overflow-y: auto; cursor: pointer; border-right: 1px solid #f0f0f0; }
.doc-list .ant-list-item { padding: 8px 16px; transition: all 0.2s; }
.doc-list .ant-list-item:hover { background-color: #f5f5f5; }
.doc-list .ant-list-item.active { background-color: #e6f7ff; border-right: 3px solid #1890ff; color: #1890ff; font-weight: 500; }
.doc-content { flex: 1; padding: 16px; overflow-y: auto; background: #fafafa; }
pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Consolas', 'Monaco', monospace; font-size: 13px; }
</style>