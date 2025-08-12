<!-- src/components/shared/BaseSidebar.vue -->
<template>
  <aside
    v-show="isVisible"
    class="absolute top-0 bottom-0 left-0 w-64 bg-white shadow-xl z-[1002] transform transition-transform duration-300 ease-out p-4 flex flex-col"
    :class="{ 'translate-x-0': isVisible, '-translate-x-full': !isVisible }"
  >
    <div class="flex justify-between items-center mb-4 pb-2 border-b">
      <!-- 头部插槽，用于自定义标题和logo -->
      <slot name="header">
        <span class="text-lg font-semibold">{{ title }}</span>
      </slot>
      <button
        @click="$emit('close')"
        class="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
        title="关闭侧边栏"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>

    <div class="flex-grow overflow-y-auto pr-1">
      <!-- 默认插槽，用于放置所有功能模块 -->
      <slot></slot>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  isVisible: { type: Boolean, required: true },
  title: { type: String, default: '工具箱' },
});
defineEmits(['close']);
</script>