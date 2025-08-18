<template>
  <!-- 加载中动画 -->
  <div v-if="loading" class="loading-container">
    <Spin tip="加载中..." />
  </div>

  <!-- 图表容器 -->
  <div v-show="!loading" ref="chartRef" class="chart-box"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { Spin, message } from 'ant-design-vue';
import * as echarts from 'echarts';
import { getKnowledgeGraph } from './rag';

// 从父组件传入 modal 是否可见
const props = defineProps<{
  visible: boolean
}>();

const loading = ref(false); // 初始为 false，仅在实际加载时为 true
const chartRef = ref<HTMLElement | null>(null);
let chartInstance: echarts.ECharts | null = null;

// 图表自适应
const resizeChart = () => {
  chartInstance?.resize();
};

const initChart = async () => {
  // 防止重复初始化
  if (chartInstance) {
    return;
  }

  // 确保 DOM 元素存在
  if (!chartRef.value) {
    await nextTick();
    if (!chartRef.value) {
      console.error("无法找到图表容器元素。");
      message.error("图表渲染失败：未找到容器。");
      return;
    }
  }

  loading.value = true;
  const start = Date.now();

  try {
    const data = await getKnowledgeGraph();
    console.log('【调试】收到的图谱数据:', data);

    if (!data?.nodes?.length) {
      message.warn('知识图谱中没有可显示的数据。');
      // 注意：即使没有数据，也会继续执行 finally 块来关闭 loading
    } else {
      // 1. 创建一个从类别名称到索引的映射
      const categoryMap = new Map<string, number>();
      data.categories.forEach((c: { name: string }, index: number) => {
        categoryMap.set(c.name, index);
      });

      // 2. 转换节点数据，将 category 名称替换为索引
      const transformedNodes = data.nodes.map((node: any) => ({
        ...node,
        category: categoryMap.get(node.category) ?? 0,
      }));

      // 初始化 ECharts 实例
      chartInstance = echarts.init(chartRef.value);
      chartInstance.setOption({
        // title: { text: '知识图谱', left: 'center' },
        tooltip: {
          formatter: (params: any) => {
            if (params.dataType === 'node') {
              return `<b>${params.data.name}</b><br/>${params.data.value || ''}`;
            }
            if (params.dataType === 'edge') {
              return params.data.label?.formatter || '';
            }
            return '';
          }
        },
        legend: [{
          data: data.categories.map((a: any) => a.name),
          orient: 'vertical',
          right: 10,
          top: 20
        }],
        series: [{
          type: 'graph',
          layout: 'force',
          data: transformedNodes, // 使用转换后的数据
          links: data.links,
          categories: data.categories,
          roam: true,
          label: {
            show: true,
            position: 'right',
            formatter: '{b}'
          },
          force: {
            repulsion: 150,
            edgeLength: 60
          },
          edgeSymbol: ['circle', 'arrow'],
          edgeSymbolSize: [4, 8]
        }]
      });
      window.addEventListener('resize', resizeChart);
    }
  } catch (error) {
    console.error('加载知识图谱失败', error);
    message.error('加载知识图谱失败，请查看控制台获取详情。');
  } finally {
    // 确保 loading 动画至少显示 300 毫秒，避免闪烁
    const elapsed = Date.now() - start;
    const delay = Math.max(0, 300 - elapsed);
    setTimeout(() => {
      loading.value = false;
      // 在 loading 结束后，DOM 变为可见，此时再执行 resize
      nextTick(() => {
        chartInstance?.resize();
      });
    }, delay);
  }
};

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      // 当 modal 变为可见时，等待其动画（约300ms）完成后再执行操作
      setTimeout(() => {
        if (!chartInstance) {
          initChart(); // 如果是第一次打开，则初始化
        } else {
          // 如果已经初始化过，仅需调整大小
          nextTick(() => {
            chartInstance?.resize();
          });
        }
      }, 300);
    }
  }
);

onMounted(() => {
  // 处理初始状态就是可见的情况
  if (props.visible) {
    setTimeout(initChart, 300);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart);
  chartInstance?.dispose();
  chartInstance = null; // 彻底清理
});
</script>

<style scoped>
.chart-box {
  width: 100%;
  height: 60vh;
  min-height: 400px;
}
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 60vh;
}
</style>