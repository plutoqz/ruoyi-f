// src/api/system/rag.ts

// 1. 导入项目封装好的 requestClient
// 确认这个路径在你项目中是正确的，例如：'@/utils/request'
import { requestClient } from '#/api/request';

// 定义 API 的访问路径
const Api = {
  Query: '/system/rag/query',
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
  const payload: RagQueryPayload = { question };

  // 2. 按照 post(url, data, config) 的方式调用
  //    泛型 <string> 告诉 requestClient 我们期望返回的数据类型是 string
  return requestClient.post<string>(
    Api.Query, // 第一个参数: url
    payload,   // 第二个参数: data
    {
        timeout: 120_000,
      // 第三个参数: config (可选)
      // 如果这个请求成功后不希望弹出全局的 "操作成功" 消息，可以设置
      // successMessageMode: 'none',
    }
  );
}