// src/api/system/rag.ts

// 1. 导入项目封装好的 requestClient
// 确认这个路径在你项目中是正确的，例如：'@/utils/request'
import { requestClient } from '#/api/request';

// 定义 API 的访问路径
const Api = {
  Query: '/system/rag/query',
  Documents: '/system/rag/documents',
  Graph: '/system/rag/graph',
};

// 定义请求的数据载荷类型 (Payload)
interface RagQueryPayload {
  question: string;
}

/**
 * @description: 向 RAG 智能问答服务发送查询
 * @param {string} question - 用户输入的问题
 * @returns {Promise<string>} - 返回一个包含答案字符串的 Promise
 */
export function queryRAG(question: string): Promise<string> {
  // const payload: RagQueryPayload = { question };

  // // 2. 按照 post(url, data, config) 的方式调用
  // //    泛型 <string> 告诉 requestClient 我们期望返回的数据类型是 string
  // return requestClient.post<string>(
  //   Api.Query, // 第一个参数: url
  //   payload,   // 第二个参数: data
  //   {
  //       timeout: 120_000,
  //     // 第三个参数: config (可选)
  //     // 如果这个请求成功后不希望弹出全局的 "操作成功" 消息，可以设置
  //     // successMessageMode: 'none',
  //   }
  // );
  return requestClient.post<string>(Api.Query, { question });
}

/**
 * @description 获取知识库文档列表
 */
export function getKnowledgeDocuments() {
  return requestClient.get<any[]>(Api.Documents);
}

/**
 * @description 获取知识图谱数据
 */
export function getKnowledgeGraph() {
  return requestClient.get<any>(Api.Graph);
}


// --- 新增/修改知识库构建相关的 API 函数 ---

const BuildApi = {
  Start: '/system/rag/build/start',
  Commit: '/system/rag/build/commit',
  Abort: '/system/rag/build/abort',
  // 注意：这个路径我们假设通过 ViteProxy 直接代理到 Python
  Preview: '/system/rag/build/preview', 
  Status: '/system/rag/build/status',
};

/**
 * @description 上传文件并开始构建知识库
 * @param {File[]} files - 用户选择的文件
 * @returns {Promise<string>} - 返回任务 ID
 */
export function startKnowledgeBuild(files: File[]): Promise<string> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  // --- 正确的调用方式 ---
  return requestClient.post<string>(
    BuildApi.Start, // 第一个参数: url (string)
    formData,       // 第二个参数: data (any)
    {               // 第三个参数: config (AxiosRequestConfig)
      headers: {
        // multipart/form-data 通常由浏览器根据 FormData 自动设置，
        // 但如果 requestClient 默认会覆盖为 application/json，则需要手动指定
        'Content-Type': 'multipart/form-data',
      },
      // 如果上传大文件，可以设置更长的超时时间
      // timeout: 300_000, 
    }
  );
}

/**
 * @description 确认并应用构建好的知识库
 */
export function commitKnowledgeBuild(taskId: string) {
  // 3. 将 taskId 直接拼接到 URL 后面
  const url = `${BuildApi.Commit}/${taskId}`;
  // post(url, data, config)
  return requestClient.post(
    url,
    null, // data 为空
    { successMessageMode: 'message' } // config
  );
}

/**
 * @description 中止并清理构建任务
 */
export function abortKnowledgeBuild(taskId: string) {
  // 3. 将 taskId 直接拼接到 URL 后面
  const url = `${BuildApi.Abort}/${taskId}`;
  return requestClient.post(url);
}

/**
 * @description 获取构建完成的知识图谱预览数据
 * @param {string} taskId - 任务 ID
 */
export function getBuildPreviewGraph(taskId: string) {
    // URL 现在指向 Java 代理
    const previewUrl = `${BuildApi.Preview}/${taskId}`;
    // 使用 requestClient 来调用，保持统一性
    return requestClient.get<any>(previewUrl);
}


/**
 * @description 获取构建任务的状态
 * @param {string} taskId - 任务 ID
 */
// ✅ 直接把 url 作为第一个参数
export function getBuildStatus(taskId: string): Promise<any> {
  return requestClient.get(`${BuildApi.Status}/${taskId}`);
}


// --- 新增 Neo4j 查询相关的 API 函数 ---

const KgApi = {
  FullGraph: '/system/RAGkg/full-graph',
};

// 定义从 Neo4j 返回的图谱数据结构 (与 Java DTO 对应)
// 这有助于在 TypeScript 中获得更好的类型提示和安全
interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, any>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  properties: Record<string, any>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}


/**
 * @description 从 Neo4j 数据库获取完整的知识图谱数据
 * @param {number} [limit=500] - 限制返回的节点数量，防止数据量过大导致前端卡顿
 * @returns {Promise<GraphData>} - 返回格式化好的图谱数据
 */
export function getFullGraphFromNeo4j(limit: number = 200): Promise<GraphData> {
  // 使用 requestClient.get 方法发起 GET 请求
  // 泛型 <GraphData> 告诉 requestClient 我们期望返回的数据类型
  return requestClient.get<GraphData>(
    KgApi.FullGraph, // 第一个参数: url (string)
    {                // 第二个参数: config (AxiosRequestConfig)
      params: {
        limit, 
      },
    }
  );
}