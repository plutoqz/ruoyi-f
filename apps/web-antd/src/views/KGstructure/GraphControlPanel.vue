<template>
  <div class="card">
    <h2>4. 生成图谱</h2>
    <div class="action-buttons">
      <button class="btn primary large" @click="$emit('generate-graph')" :disabled="isGenerating">
        {{ isGenerating ? '生成中...' : '生成知识图谱' }}
      </button>
      <button class="btn secondary large" @click="$emit('reset-all')">
        重置所有
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isGenerating: {
    type: Boolean,
    default: false
  }
});
defineEmits(['generate-graph', 'reset-all']);
</script>

<style scoped>
.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: space-between;
}
.action-buttons .btn {
    flex-grow: 1;
}
</style>