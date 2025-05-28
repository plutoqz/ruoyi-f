<template>
  <aside
    v-show="isVisible"
    class="absolute top-0 bottom-0 left-0 w-56 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-out p-6"
    :class="{ 'translate-x-0': isVisible, '-translate-x-full': !isVisible }"
  >
    <div class="flex justify-between items-center mb-6">
      <img
        v-if="providerLogo"
        :src="providerLogo"
        :alt="providerName + ' Logo'"
        class="h-8 object-contain"
      />
      <span v-else class="text-sm font-semibold">{{ providerName || '地图工具' }}</span>
      <button
        @click="closeSidebar"
        class="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
        title="关闭侧边栏"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="feather feather-x"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <nav>
      <ul class="space-y-2">
        <li>
          <GeoJsonImporter @geojson-loaded="onGeoJsonLoaded" @geojson-error="onGeoJsonError" />
        </li>
        <!-- 例如:
        <li>
          <button class="group flex items-center p-2 rounded hover:bg-gray-100 text-gray-700 transition-colors duration-300 w-full text-left">
            <i class="fi fi-rs-settings-sliders" style="font-size: 1.25rem;color: currentColor; width: 16px; height: 28px; display: inline-block; margin-right: 24px; vertical-align: middle;"></i>
            <span class="group-hover:text-blue-500 transition-colors duration-300 text-base md:text-lg" style="vertical-align: middle;">
              图层控制
            </span>
          </button>
        </li>
        -->
      </ul>
    </nav>
  </aside>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import GeoJsonImporter from './GeoJsonImporter.vue'; // 假设 GeoJsonImporter.vue 在同一目录

// 定义 props
const props = defineProps({
  isVisible: {
    type: Boolean,
    required: true,
  },
  providerLogo: {
    type: String,
    default: '',
  },
  providerName: {
    type: String,
    default: '当前地图',
  }
});

// 定义 emits
const emit = defineEmits(['close-sidebar', 'geojson-loaded', 'geojson-error']);

// 方法：关闭侧边栏
const closeSidebar = () => {
  emit('close-sidebar');
};

// 方法：当中继来自 GeoJsonImporter 的事件时
const onGeoJsonLoaded = (geojsonData) => {
  emit('geojson-loaded', geojsonData);
};

const onGeoJsonError = (errorMessage) => {
  emit('geojson-error', errorMessage);
};
</script>

<style scoped>
/* 侧边栏特定样式可以放在这里 */
/* 确保 Flaticon CSS 链接在应用级别已加载 */
/* 例如: @import url('https://cdn-uicons.flaticon.com/3.0.0/uicons-regular-straight/css/uicons-regular-straight.css'); */
/* 或者在 public/index.html 中引入 */
</style>