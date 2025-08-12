// src/map-logic/sdkLoader.js

/**
 * 通用的脚本加载函数
 * @param {string} src - 脚本的URL
 * @param {string} id - 脚本元素的ID
 * @returns {Promise<void>}
 */
function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(id);
    if (existingScript) {
      // 假设已加载的脚本是可用的
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.id = id;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
        console.error(`加载脚本失败: ${src}`);
        reject(new Error(`Failed to load script: ${src}`));
    };
    document.head.appendChild(script);
  });
}

/**
 * 加载高德地图JS API
 * @param {string} key - 你的高德地图Key
 * @param {string} securityCode - 你的高德地图安全密钥
 * @returns {Promise<void>}
 */
export function loadAmapSdk(key, securityCode) {
  window._AMapSecurityConfig = { securityJsCode: securityCode };
  const plugins = 'AMap.PlaceSearch,AMap.Geocoder,AMap.GeoJSON,AMap.MouseTool,AMap.GeometryUtil';
  return loadScript(`https://webapi.amap.com/maps?v=2.0&key=${key}&plugin=${plugins}`, 'amap-sdk');
}

/**
 * 加载腾讯地图JS API (使用JSONP回调)
 * @param {string} key - 你的腾讯地图Key
 * @returns {Promise<void>}
 */
export function loadTencentSdk(key) {
  return new Promise((resolve, reject) => {
    const callbackName = 'tencentMapInit';
    window[callbackName] = () => {
      delete window[callbackName];
      resolve();
    };
    loadScript(`https://map.qq.com/api/js?v=2.exp&key=${key}&libraries=place,drawing,geometry&callback=${callbackName}`, 'tencent-sdk')
      .catch(reject);
  });
}

// OpenLayers 是通过 npm 安装和 import 的，所以不需要加载器。