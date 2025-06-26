<template>
  <div class="container">
    <header>
      <h1>土地处罚案例公开</h1>
    </header>
    
    <main>
      <div class="card">
        <!-- 整合后的搜索筛选区域 -->
        <div class="search-filter-container">
          <div class="search-section">
            <div class="search-box">
              <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="请输入关键字..."
                @keyup.enter="performSearch"
              />
              <button class="btn-search" @click="performSearch">
                <i class="fas fa-search"></i>搜索
              </button>
            </div>
            <!-- <div class="search-tips">
              <i class="fas fa-lightbulb"></i> 提示：可搜索案例标题、发布单位或内容关键词
            </div> -->
          </div>
          
          <div class="filter-section">
            <!-- 日期筛选，固定宽度 -->
            <div class="filter-group date-filter-group">
              <label>日期</label>
              <div class="date-range">
                <input type="date" v-model="filterParams.startDate">
                <span>至</span>
                <input type="date" v-model="filterParams.endDate">
              </div>
            </div>

            <!-- 处罚类型，可伸缩 -->
            <div class="filter-group">
              <label>处罚类型</label>
              <select v-model="filterParams.penaltyType">
                <option value="">全部类型</option>
                <option v-for="type in penaltyTypes" :value="type.value">{{ type.label }}</option>
              </select>
            </div>

            <!-- 位置区域，可伸缩 -->
            <div class="filter-group">
              <label>位置区域</label>
              <select v-model="filterParams.location">
                <option value="">全部区域</option>
                <option v-for="area in locations" :value="area.value">{{ area.label }}</option>
              </select>
            </div>

            <!-- 按钮组，固定不收缩 -->
            <div class="filter-buttons">
              <button class="btn-filter" @click="applyFilters">确定</button>
              <button class="btn-reset" @click="resetFilters">重置</button>
            </div>
          </div>

        </div>

        <div class="documents-container">
          <div class="section-title">
            <i class="fas fa-file-alt"></i>
            <h2>案例公开列表</h2>
          </div>
          
          <ul class="file-list">
            <li class="file-item" v-for="(file, index) in paginatedDocuments" :key="index">
              <div class="file-bullet">
                <i class="fas fa-circle"></i>
              </div>
              <div class="file-content">
                <!-- 1. 使用 v-html 和高亮方法替换 {{ file.title }} -->
                <div class="file-title" v-html="highlightText(file.title)"></div>
                <div class="file-meta">
                  <div class="file-date">
                    <i class="fas fa-calendar-alt"></i>
                    {{ file.date }}
                  </div>
                  <!-- <div class="file-department">
                    <i class="fas fa-building"></i>
                    <span v-html="highlightText(file.department)"></span>
                  </div> -->
                </div>
                <div v-if="expandedItemIndex === index" class="file-details" v-html="highlightText(file.text)"></div>
              </div>
              <div class="file-actions">
                <button class="btn btn-view" @click="toggleDetails(index)">
                  <i class="fas fa-eye"></i>
                  <!-- 根据状态改变按钮文字 -->
                  {{ expandedItemIndex === index ? '收起' : '查看' }}
                </button>
                <button class="btn btn-download">
                  <i class="fas fa-download"></i>下载
                </button>
              </div>
            </li>
            <li v-if="displayedDocuments.length === 0" class="no-results">
              <p>没有找到匹配的案例，或列表为空。</p>
            </li>
          </ul>

          <div class="pagination-controls" >
            <!-- 1. Add the dropdown to change itemsPerPage -->
            <div class="items-per-page-selector">
              <span>每页显示:</span>
              <select v-model="itemsPerPage">
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </div>

            <div class="pagination-container" v-if="totalPages > 1">
              <button 
                class="btn btn-page" 
                @click="prevPage" 
                :disabled="currentPage === 1">
                上一页
              </button>
              <template v-for="(page, index) in visiblePages" :key="index">
                <!-- If the page item is a number, render a button -->
                <button 
                  v-if="typeof page === 'number'"
                  class="btn btn-page" 
                  :class="{ active: page === currentPage }" 
                  @click="goToPage(page)">
                  {{ page }}
                </button>
                <!-- Otherwise, it's an ellipsis, render a span -->
                <span v-else class="pagination-ellipsis">...</span>
              </template>
              <button 
                class="btn btn-page" 
                @click="nextPage" 
                :disabled="currentPage === totalPages">
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
// 3. 从 'vue' 导入 computed
import { ref, onMounted, computed, watch, reactive } from 'vue';
import * as xlsx from 'xlsx';

const documents = ref([]);
const displayedDocuments = ref([]); // 存储当前要在页面上显示的数据
// 4. 为搜索框创建一个响应式引用
const searchQuery = ref('');
const searchKeywords = ref([]);

//检索
const filterParams = reactive({
  startDate: '1999-01-01',
  endDate: '2025-06-25',
  penaltyType: '',
  location: '',
  department: ''
});
const penaltyTypes = ref([
  { value: 'illegal_construction', label: '违法建设' },
  { value: 'land_occupation', label: '非法占地' },
  { value: 'environmental', label: '环境违法' },
  { value: 'planning', label: '规划违规' },
  { value: 'mining', label: '非法采矿' },
  { value: 'agriculture', label: '破坏农用地' }
]);

const locations = ref([
  // 4个直辖市
  { value: 'beijing', label: '北京市' },
  { value: 'tianjin', label: '天津市' },
  { value: 'shanghai', label: '上海市' },
  { value: 'chongqing', label: '重庆市' },
  
  // 23个省
  { value: 'hebei', label: '河北省' },
  { value: 'shanxi', label: '山西省' }, // 注意与陕西省的区别
  { value: 'liaoning', label: '辽宁省' },
  { value: 'jilin', label: '吉林省' },
  { value: 'heilongjiang', label: '黑龙江省' },
  { value: 'jiangsu', label: '江苏省' },
  { value: 'zhejiang', label: '浙江省' },
  { value: 'anhui', label: '安徽省' },
  { value: 'fujian', label: '福建省' },
  { value: 'jiangxi', label: '江西省' },
  { value: 'shandong', label: '山东省' },
  { value: 'henan', label: '河南省' },
  { value: 'hubei', label: '湖北省' },
  { value: 'hunan', label: '湖南省' },
  { value: 'guangdong', label: '广东省' },
  { value: 'hainan', label: '海南省' },
  { value: 'sichuan', label: '四川省' },
  { value: 'guizhou', label: '贵州省' },
  { value: 'yunnan', label: '云南省' },
  { value: 'shaanxi', label: '陕西省' }, // 使用 shaanxi 以区别山西
  { value: 'gansu', label: '甘肃省' },
  { value: 'qinghai', label: '青海省' },
  { value: 'taiwan', label: '台湾省' },

  // 5个自治区
  { value: 'neimenggu', label: '内蒙古自治区' },
  { value: 'guangxi', label: '广西壮族自治区' },
  { value: 'xizang', label: '西藏自治区' },
  { value: 'ningxia', label: '宁夏回族自治区' },
  { value: 'xinjiang', label: '新疆维吾尔自治区' },

  // 2个特别行政区
  { value: 'xianggang', label: '香港特别行政区' }, // 使用拼音 xianggang 保持一致性
  { value: 'aomen', label: '澳门特别行政区' }   // 使用拼音 aomen 保持一致性
]);
const locationMap = {
  // 4个直辖市
  '北京市': 'beijing',
  '天津市': 'tianjin',
  '上海市': 'shanghai',
  '重庆市': 'chongqing',

  // 23个省
  '河北省': 'hebei',
  '山西省': 'shanxi',
  '辽宁省': 'liaoning',
  '吉林省': 'jilin',
  '黑龙江省': 'heilongjiang',
  '江苏省': 'jiangsu',
  '浙江省': 'zhejiang',
  '安徽省': 'anhui',
  '福建省': 'fujian',
  '江西省': 'jiangxi',
  '山东省': 'shandong',
  '河南省': 'henan',
  '湖北省': 'hubei',
  '湖南省': 'hunan',
  '广东省': 'guangdong',
  '海南省': 'hainan',
  '四川省': 'sichuan',
  '贵州省': 'guizhou',
  '云南省': 'yunnan',
  '陕西省': 'shaanxi',
  '甘肃省': 'gansu',
  '青海省': 'qinghai',
  '台湾省': 'taiwan',

  // 5个自治区
  '内蒙古自治区': 'neimenggu',
  '广西壮族自治区': 'guangxi',
  '西藏自治区': 'xizang',
  '宁夏回族自治区': 'ningxia',
  '新疆维吾尔自治区': 'xinjiang',

  // 2个特别行政区
  '香港特别行政区': 'xianggang',
  '澳门特别行政区': 'aomen'
};


// const departments = ref([
//   { value: 'ministry', label: '自然资源部' },
//   { value: 'province', label: '省级自然资源厅' },
//   { value: 'city', label: '市级自然资源局' },
//   { value: 'county', label: '县级自然资源局' },
//   { value: 'bureau', label: '土地监察局' }
// ]);



const currentPage = ref(1);
const itemsPerPage = ref(20); 
const totalPages = computed(() => {
  if (displayedDocuments.value.length === 0) return 1;
  return Math.ceil(displayedDocuments.value.length / itemsPerPage.value);
});
const expandedItemIndex = ref(null); // null 表示没有项是展开的

const paginatedDocuments = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return displayedDocuments.value.slice(start, end);
});
const visiblePages = computed(() => {
  const maxVisible = 7; // Maximum number of page buttons to show (must be an odd number)
  if (totalPages.value <= maxVisible) {
    // If total pages are less than max, show all pages
    return Array.from({ length: totalPages.value }, (_, i) => i + 1);
  }
  const pages = [];
  const half = Math.floor(maxVisible / 2);
  // Always add the first page
  pages.push(1);
  // Logic for the middle section with ellipses
  let start = currentPage.value - half + 1;
  let end = currentPage.value + half - 1;
  if (currentPage.value <= half) {
    start = 2;
    end = maxVisible - 1;
  } else if (currentPage.value >= totalPages.value - half) {
    start = totalPages.value - maxVisible + 2;
    end = totalPages.value - 1;
  }
  // Ellipsis after first page
  if (start > 2) {
    pages.push('...');
  }
  // Add the range of pages
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  // Ellipsis before last page
  if (end < totalPages.value - 1) {
    pages.push('...');
  }
  // Always add the last page
  pages.push(totalPages.value);
  return pages;
});
watch(itemsPerPage, () => {
  currentPage.value = 1;
});


const updateDisplayedDocuments = () => {
  currentPage.value = 1; // 每次筛选都重置到第一页

  const query = searchQuery.value.toLowerCase().trim();
  const keywords = query.split(/\s+/).filter(Boolean);

  // 1. 从最原始的数据开始过滤
  let filtered = documents.value;

  // 2. 应用关键词搜索
  if (keywords.length > 0) {
    filtered = filtered.filter(doc => {
      return keywords.every(keyword => 
        (doc.title?.toLowerCase().includes(keyword) || 
         doc.text?.toLowerCase().includes(keyword))
      );
    });
  }

  // 3. 应用日期筛选
  const startDate = filterParams.startDate ? new Date(filterParams.startDate) : null;
  const endDate = filterParams.endDate ? new Date(filterParams.endDate) : null;
  
  // 为了让结束日期包含当天，我们将时间设置为当天的最后一毫秒
  if (endDate) {
    endDate.setHours(23, 59, 59, 999);
  }

  if (startDate || endDate) {
    filtered = filtered.filter(doc => {
      // 确保文档有一个有效的 dateObject
      if (!doc.dateObject) return false;
      
      const isAfterStart = startDate ? doc.dateObject >= startDate : true;
      const isBeforeEnd = endDate ? doc.dateObject <= endDate : true;
      
      return isAfterStart && isBeforeEnd;
    });
  }

  // 4. 应用其他筛选（处罚类型、位置区域）
  // 注意：这要求你的 Excel 数据中有对应的列，并在 loadDefaultFile 中正确解析
  if (filterParams.penaltyType) {
    filtered = filtered.filter(doc => doc.penaltyType === filterParams.penaltyType);
  }
  if (filterParams.location) {
    filtered = filtered.filter(doc => doc.location === filterParams.location);
  }

  // 5. 更新最终要显示的数据
  displayedDocuments.value = filtered;
};



//查看展开
const toggleDetails = (index) => {
  if (expandedItemIndex.value === index) {
    // 如果点击的是已经展开的项，则关闭它
    expandedItemIndex.value = null;
  } else {
    // 否则，展开点击的项
    expandedItemIndex.value = index;
  }
};

const performSearch = () => {
  // currentPage.value = 1;
  // const query = searchQuery.value.toLowerCase().trim();

  // if (!query) {
  //   displayedDocuments.value = documents.value;
  //   return;
  // }
  // const keywords = query.split(/\s+|(?=[^\s])/).filter(Boolean); // 去除空值 [[2]]
  // searchKeywords.value = keywords;  
  // displayedDocuments.value = documents.value.filter(doc => {
  //   // 每个关键词需在标题或文本中独立存在
  //   return keywords.every(keyword => {
  //     return (doc.title?.toLowerCase().includes(keyword) || 
  //             doc.text?.toLowerCase().includes(keyword));
  //   });
  // });
  updateDisplayedDocuments();
};

const applyFilters = () => {
  updateDisplayedDocuments();
};

// 新增：重置筛选按钮的点击事件
const resetFilters = () => {
  // 重置搜索框
  searchQuery.value = '';
  
  // 重置筛选条件
  filterParams.startDate = '1999-01-01';
  filterParams.endDate = '2025-06-25';
  filterParams.penaltyType = '';
  filterParams.location = '';

  // 重新应用（实际上是清除了所有筛选）
  updateDisplayedDocuments();
};


const goToPage = (page) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
};

const highlightText = (text) => {
  const query = searchQuery.value.trim();
  
  // 如果没有搜索词或文本为空，直接返回原始文本
  if (!query || !text) {
    return text;
  }
  
  // 创建一个正则表达式，'gi' 表示全局、不区分大小写匹配
  // 我们需要对用户输入的特殊字符进行转义，以防它们被当作正则表达式的元字符
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escapedQuery, 'gi');

  // 使用 replace 方法将所有匹配的子串替换为带高亮样式的 HTML
  return text.replace(regex, (match) => `<span class="highlight">${match}</span>`);
};



const loadDefaultFile = async (filePath) => {
  try {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Network response was not ok`);
    
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = xlsx.read(data, { type: 'array', cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { raw: false });
    
    if (jsonData.length > 0) {
      const provinceRegex = /^.+?(省|市|自治区|特别行政区)/;
      const parsedData = jsonData.map(item => {
        //时间
        const dateStr = item['time'] || ''; // e.g., "2020年08月"
        let dateObject = null;
        if (dateStr) {
          // 将 "2020年08月" 转换为 "2020-08"，然后创建 Date 对象
          // 这会自动设置为该月的第一天，非常适合作为比较的基准
          const formattedDateStr = dateStr.replace('年', '-').replace('月', '');
          dateObject = new Date(formattedDateStr);
        }
        //位置
        const excelType = item['type'] || '';
        const excelLocation = item['location'] || ''; // e.g., "河北省邯郸"
        let provinceName = ''; // 用于存储提取出的省名，如 "河北省"
        if (excelLocation) {
            // 使用正则表达式进行匹配
            const match = excelLocation.match(provinceRegex);
            // 如果匹配成功, match[0] 将是完整的匹配结果 (e.g., "河北省")
            if (match) {
                provinceName = match[0];
            }
        }
        return {
          title: item['title'] || '无标题',
          date: item['time'] || '未知日期', // 保留原始日期用于显示
          text: item['text'] || '无详细内容',
          dateObject: dateObject, // 新增：用于筛选和排序的 Date 对象
          location: locationMap[provinceName] || '',
          // **重要提示**: 为使其他筛选生效，您需要像这样解析它们
          // penaltyType: item['处罚类型列名'], 
          // location: item['位置区域列名'],
        };
      });
      documents.value = parsedData;
      displayedDocuments.value = parsedData; // 初始时，显示所有数据
    } else {
      alert('未从文件中读取到数据或文件为空。');
    }
  } catch (err) {
    console.error("加载默认文件失败:", err.message);
  }
};

onMounted(() => {
  loadDefaultFile('/convert.xlsx');

});
</script>


<style scoped>
@import './indexStyle.scss'

</style>