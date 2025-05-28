const PI = Math.PI;
const AXIS = 6378245.0; // 长半轴
const ECCENTRICITY = 0.00669342162296594323; // 扁率

/**
 * 判断是否超出中国大陆范围
 * @param {number} lng 经度
 * @param {number} lat 纬度
 * @returns {boolean}
 */
function isOutOfChina(lng, lat) {
  if (lng < 72.004 || lng > 137.8347) return true;
  if (lat < 0.8293 || lat > 55.8271) return true;
  return false;
}

/**
 * WGS84 坐标转 GCJ02 坐标 (火星坐标系)
 * @param {number} wgsLng WGS84 经度
 * @param {number} wgsLat WGS84 纬度
 * @returns {Array<number>} [gcjLng, gcjLat]
 */
export function wgs84togcj02(wgsLng, wgsLat) {
  if (isOutOfChina(wgsLng, wgsLat)) {
    return [wgsLng, wgsLat];
  }
  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radLat = (wgsLat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - ECCENTRICITY * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((AXIS * (1 - ECCENTRICITY)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((AXIS / sqrtMagic) * Math.cos(radLat) * PI);
  const gcjLat = wgsLat + dLat;
  const gcjLng = wgsLng + dLng;
  return [gcjLng, gcjLat];
}

/**
 * GCJ02 坐标转 WGS84 坐标
 * @param {number} gcjLng GCJ02 经度
 * @param {number} gcjLat GCJ02 纬度
 * @returns {Array<number>} [wgsLng, wgsLat]
 */
export function gcj02towgs84(gcjLng, gcjLat) {
  if (isOutOfChina(gcjLng, gcjLat)) {
    return [gcjLng, gcjLat];
  }
  let dLat = transformLat(gcjLng - 105.0, gcjLat - 35.0);
  let dLng = transformLng(gcjLng - 105.0, gcjLat - 35.0);
  const radLat = (gcjLat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - ECCENTRICITY * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((AXIS * (1 - ECCENTRICITY)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((AXIS / sqrtMagic) * Math.cos(radLat) * PI);
  const mgLat = gcjLat + dLat;
  const mgLng = gcjLng + dLng;
  return [gcjLng * 2 - mgLng, gcjLat * 2 - mgLat];
}


function transformLat(lng, lat) {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lat * PI) + 40.0 * Math.sin((lat / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((lat / 12.0) * PI) + 320 * Math.sin((lat * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(lng, lat) {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += ((20.0 * Math.sin(6.0 * lng * PI) + 20.0 * Math.sin(2.0 * lng * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(lng * PI) + 40.0 * Math.sin((lng / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((lng / 12.0) * PI) + 300.0 * Math.sin((lng / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

/**
 * 转换 GeoJSON 对象中的所有坐标
 * @param {Object} geojson GeoJSON 对象
 * @param {Function} transformFunc 坐标转换函数，如 wgs84togcj02
 * @returns {Object} 转换后的 GeoJSON 对象 (深拷贝)
 */
export function transformGeoJsonCoords(geojson, transformFunc) {
  if (!geojson || !transformFunc) return geojson;

  // 深拷贝以避免修改原始对象
  const newGeoJson = JSON.parse(JSON.stringify(geojson));

  function transformCoordinates(coords) {
    if (Array.isArray(coords) && coords.length > 0) {
      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        // 单个坐标点 [lng, lat]
        return transformFunc(coords[0], coords[1]);
      } else if (Array.isArray(coords[0])) {
        // 坐标数组 [[lng, lat], [lng, lat], ...] 或 [[[lng, lat], ...], ...]
        return coords.map(transformCoordinates);
      }
    }
    return coords; // 不是有效坐标则原样返回
  }

  if (newGeoJson.type === 'FeatureCollection') {
    newGeoJson.features.forEach(feature => {
      if (feature.geometry && feature.geometry.coordinates) {
        feature.geometry.coordinates = transformCoordinates(feature.geometry.coordinates);
      }
    });
  } else if (newGeoJson.type === 'Feature') {
    if (newGeoJson.geometry && newGeoJson.geometry.coordinates) {
      newGeoJson.geometry.coordinates = transformCoordinates(newGeoJson.geometry.coordinates);
    }
  } else if (newGeoJson.geometry && newGeoJson.geometry.coordinates) { // 直接是 Geometry 对象
     newGeoJson.geometry.coordinates = transformCoordinates(newGeoJson.geometry.coordinates);
  } else if (newGeoJson.coordinates) { // 可能直接是 coordinates 数组 (例如 MultiPoint 等)
     newGeoJson.coordinates = transformCoordinates(newGeoJson.coordinates);
  }


  return newGeoJson;
}