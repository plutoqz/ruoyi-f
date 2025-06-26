<script setup lang="ts">
import { VbenAvatar } from '../avatar';

interface Props {
  /**
   * @zh_CN 是否收起文本
   */
  collapsed?: boolean;
  /**
   * @zh_CN Logo 跳转地址
   */
  href?: string;
  /**
   * @zh_CN Logo 图片大小
   */
  logoSize?: number;
  /**
   * @zh_CN Logo 图标
   */
  src?: string;
  /**
   * @zh_CN Logo 文本
   */
  text: string;
  /**
   * @zh_CN Logo 主题
   */
  theme?: string;
  /**
   * @zh_CN Logo 文本字号（单位 px）
   */
  textSize?: number;
}

defineOptions({
  name: 'VbenLogo',

});

withDefaults(defineProps<Props>(), {
  collapsed: false,
  href: 'javascript:void 0',
  logoSize: 32,
  src: '',
  theme: 'light',
  textSize: 18,
});
</script>

<template>
  <div :class="theme" class="flex h-full items-center" :style="{ fontSize: textSize + 'px' }">
    <a
      :class="$attrs.class"
      :href="href"
      class="flex h-full items-center gap-2 overflow-hidden px-3 leading-normal transition-all duration-500"
    >
      <VbenAvatar
        v-if="src"
        :alt="text"
        :src="src"
        class="relative w-8 rounded-none bg-transparent"
      />
      <span
        v-if="!collapsed"
        class="text-foreground truncate whitespace-nowrap font-semibold"
        :style="{ fontSize: textSize + 'px' }"
      >
        {{ text }}
      </span>
    </a>
  </div>
</template>
