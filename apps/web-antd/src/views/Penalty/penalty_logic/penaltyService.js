/**
 * @file penaltyService.js
 * @description 封装处罚逻辑的服务 (已更新)
 */

import { penaltyRules } from './penaltyRules.js';

// 将用户界面中的违规选项映射到规则ID
const VIOLATION_MAP = {
  '非法占用土地(未批先建)': 'illegal_land_occupation',
  '擅自将农用地改为建设用地': 'illegal_land_use_change',
  '非法转让土地': 'illegal_land_transfer',
  '农村村民非法占地建住宅': 'illegal_housing_construction',
  '拒不履行土地复垦义务': 'refusal_to_reclaim_land',
  '临时用地上建永久建筑': 'permanent_construction_on_temporary_land',
  '临时用地逾期未恢复': 'failure_to_restore_temporary_land',
};

/**
 * 根据违规类型和图层信息，生成处罚详情
 * @param {string} violationType - 违规类型 (例如: '非法占用土地(未批先建)')
 * @param {object} layerDetails - 图层信息
 * @returns {{report: string, fine: number, fineText: string}} - 包含报告、可计算罚款金额(否则为NaN)和罚款描述文本的对象
 */
export function getPenaltyDetails(violationType, layerDetails) {
  const { name, area = 0, center = [0, 0], landType } = layerDetails;
  
  const ruleId = VIOLATION_MAP[violationType];
  const rule = penaltyRules.find(r => r.id === ruleId);

  if (!rule) {
    return {
      report: `【${name}】\n错误: 未能找到针对“${violationType}”的有效处罚规则。`,
      fine: 0,
      fineText: '错误'
    };
  }

  // 根据规则判断严重等级
  // 注意：对于需要 'illegalIncome' 等额外参数的规则，这里暂时无法精确判断等级，
  // 我们默认使用 '一般' 等级作为示例，实际应用中可能需要UI提供更多输入。
  const level = rule.determineLevel({ area, landType }) || '一般';
  const penaltyInfo = rule.penalties[level];

  let totalFine = 0;
  let fineText = '无罚款';

  // 根据不同的罚款类型生成文本
  if (penaltyInfo.finePerSqm) {
    const finePerSqm = (penaltyInfo.finePerSqm.min + penaltyInfo.finePerSqm.max) / 2;
    totalFine = Math.round(area * finePerSqm);
    fineText = `人民币 ${totalFine.toLocaleString()} 元整`;
  } else if (penaltyInfo.finePercentageOfIllegalIncome) {
    const { min, max } = penaltyInfo.finePercentageOfIllegalIncome;
    fineText = `按违法所得的 ${min}% ~ ${max}% 处以罚款 (需手动计算)`;
    totalFine = NaN; // 标记为不可累加
  } else if (penaltyInfo.fineAsMultipleOfReclamationFee) {
    const { min, max } = penaltyInfo.fineAsMultipleOfReclamationFee;
    fineText = `按土地复垦费的 ${min} ~ ${max} 倍处以罚款 (需手动计算)`;
    totalFine = NaN; // 标记为不可累加
  } else if (penaltyInfo.hasOwnProperty('fine') && penaltyInfo.fine > 0) {
    totalFine = penaltyInfo.fine;
    fineText = `人民币 ${totalFine.toLocaleString()} 元整`;
  }

  const deadline = penaltyInfo.deadlineInDays || 15;

  const opinionActions = penaltyInfo.actions.map((action, index) => `${index + 1}. ${action}`).join('\n');
  
  const opinionText = `
${opinionActions}
${penaltyInfo.deadlineInDays ? `${penaltyInfo.actions.length + 1}. 限期 ${deadline} 日内改正。` : ''}
${fineText !== '无罚款' ? `${penaltyInfo.actions.length + (penaltyInfo.deadlineInDays ? 2 : 1)}. 处以罚款：${fineText}。` : ''}
  `.trim();

  const report = `
【${name}】
事项类型: ${violationType} (${rule.name})
违法情形: ${level} (${penaltyInfo.description})
区域位置: 经度 ${center[0].toFixed(6)}, 纬度 ${center[1].toFixed(6)}
区域面积: ${area.toFixed(2)} 平方米

处罚依据:
${rule.legalBasis}

处理意见:
${opinionText}
  `.trim();

  return { report, fine: totalFine, fineText };
}