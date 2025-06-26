<template>
  <div class="container">
      <header>
        <h1><i class="fas fa-landmark"></i> 土地违规案例展示系统</h1>
        <p>展示全国各地土地违规案例数据，支持关键词搜索与数据源切换，提高土地管理透明度</p>
      </header>
      
      <div class="search-container">
        <input 
          type="text" 
          class="search-box" 
          placeholder="输入关键词搜索案例（如：耕地、违建、非法占用...）" 
          v-model="searchKeyword"
        >
        <div class="search-icon">
          <i class="fas fa-search"></i>
        </div>
      </div>
      
      <div class="controls">
        <div class="source-toggle">
          <button 
            class="source-btn" 
            :class="{ active: dataSource === 'json' }"
            @click="switchDataSource('json')"
          >
            <i class="fas fa-file-code"></i> JSON案例库
          </button>
          <button 
            class="source-btn" 
            :class="{ active: dataSource === 'excel' }"
            @click="switchDataSource('excel')"
          >
            <i class="fas fa-file-excel"></i> Excel案例库
          </button>
        </div>
        
        <div class="stats">
          <div class="stat-item">
            <i class="fas fa-database"></i>
            <span>数据源：{{ dataSource === 'json' ? 'JSON' : 'Excel' }}</span>
          </div>
          <div class="stat-item">
            <i class="fas fa-list"></i>
            <span>案例总数：{{ allCases.length }}</span>
          </div>
          <div class="stat-item">
            <i class="fas fa-filter"></i>
            <span>筛选结果：{{ filteredCases.length }}</span>
          </div>
        </div>
      </div>
      
      <div class="case-grid">
        <!-- 加载状态 -->
        <div class="loading" v-if="loading">
          <div class="spinner"></div>
          <h3>正在加载案例数据...</h3>
        </div>
        
        <!-- 无结果状态 -->
        <div class="no-results" v-else-if="filteredCases.length === 0">
          <i class="fas fa-file-exclamation"></i>
          <h3>未找到匹配的案例</h3>
          <p>请尝试使用其他关键词进行搜索</p>
        </div>
        
        <!-- 案例卡片 -->
        <div class="case-card" v-for="(item, index) in filteredCases" :key="index">
          <div class="card-header">
            <h3>{{ highlightKeywords(item.title || item.公告) }}</h3>
            <div class="card-badge">{{ dataSource === 'json' ? 'JSON' : 'Excel' }}</div>
          </div>
          <div class="card-body">
            <div class="card-content">
              <p v-if="dataSource === 'json'">{{ highlightKeywords(item.text) }}</p>
              <div v-else>
                <p><strong>地点：</strong>{{ highlightKeywords(item.地点) }}</p>
                <p><strong>时间：</strong>{{ item.时间 }}</p>
                <p><strong>详情：</strong>{{ highlightKeywords(item.公告) }}</p>
              </div>
            </div>
            <div class="card-meta">
              <div>
                <i class="fas fa-map-marker-alt"></i> {{ item.地点 || '未提供地点' }}
              </div>
              <div>
                <i class="fas fa-calendar"></i> {{ item.时间 || '未提供时间' }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <footer>
        <p>土地违规案例展示系统 &copy; {{ new Date().getFullYear() }} | 数据仅供参考</p>
      </footer>
    </div>
</template>

<script>
    const { createApp, ref, computed, onMounted } = Vue;
    
    createApp({
      setup() {
        // 数据状态
        const jsonCases = ref([]);
        const excelCases = ref([]);
        const dataSource = ref('json');
        const searchKeyword = ref('');
        const loading = ref(true);
        
        // 计算当前数据源的所有案例
        const allCases = computed(() => {
          return dataSource.value === 'json' ? jsonCases.value : excelCases.value;
        });
        
        // 过滤案例（基于搜索关键词）
        const filteredCases = computed(() => {
          if (!searchKeyword.value.trim()) return allCases.value;
          
          const keyword = searchKeyword.value.toLowerCase();
          return allCases.value.filter(item => {
            // 根据数据源结构检查不同字段
            if (dataSource.value === 'json') {
              return (
                (item.title && item.title.toLowerCase().includes(keyword)) ||
                (item.text && item.text.toLowerCase().includes(keyword))
              );
            } else {
              return (
                (item.公告 && item.公告.toLowerCase().includes(keyword)) ||
                (item.地点 && item.地点.toLowerCase().includes(keyword))
              );
            }
          });
        });
        
        // 高亮关键词
        const highlightKeywords = (text) => {
          if (!text || !searchKeyword.value.trim()) return text;
          
          const keyword = searchKeyword.value;
          const regex = new RegExp(`(${keyword})`, 'gi');
          return text.replace(regex, '<span class="highlight">$1</span>');
        };
        
        // 切换数据源
        const switchDataSource = (source) => {
          dataSource.value = source;
          searchKeyword.value = '';
        };
        
        // 加载JSON数据
        const loadJsonData = async () => {
          try {
            const response = await fetch('land_cases.json');
            jsonCases.value = await response.json();
          } catch (error) {
            console.error('加载JSON数据失败:', error);
          }
        };
        
        // 加载Excel（CSV）数据
        const loadExcelData = async () => {
          try {
            const response = await fetch('land_cases.csv');
            const csvText = await response.text();
            
            // 简单CSV解析
            const lines = csvText.split('\n');
            const headers = lines[0].split(',').map(header => header.trim());
            
            const data = [];
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(',');
              if (values.length === headers.length) {
                const entry = {};
                headers.forEach((header, index) => {
                  entry[header] = values[index].trim();
                });
                data.push(entry);
              }
            }
            
            excelCases.value = data;
          } catch (error) {
            console.error('加载CSV数据失败:', error);
          }
        };
        
        // 初始化加载数据
        onMounted(async () => {
          loading.value = true;
          await Promise.all([loadJsonData(), loadExcelData()]);
          loading.value = false;
        });
        
        return {
          jsonCases,
          excelCases,
          dataSource,
          searchKeyword,
          loading,
          allCases,
          filteredCases,
          highlightKeywords,
          switchDataSource
        };
      }
    }).mount('#app');
  </script>

<style scoped>
/* All CSS from the original file is placed here */
@import './cases2Style.scss'
</style>
