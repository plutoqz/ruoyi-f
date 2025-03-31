<template>
  <div id="map-container"></div>
</template>

<script>
import AMapLoader from '@amap/amap-jsapi-loader';

export default {
  name: 'GaodeMap',
  data() {
    return {
      map: null,
    };
  },
  mounted() {
    this.initMap();
  },
  methods: {
    async initMap() {
      try {
        await AMapLoader.load({
          key: '5d4d6dae7a5c65efb514bae12e669422', // 替换成你的Key
          version: '2.0',
          plugins: [], // 需要加载的插件
        });

        this.map = new AMap.Map('map-container', {
          resizeEnable: true,
          zoom: 12,
          center: [113, 28.2],
        });
      } catch (error) {
        console.error('高德地图加载失败', error);
      }
    },
  },
};
</script>

<style scoped>
#map-container {
  width: 100%;
  height: 100vh;
}
</style>
