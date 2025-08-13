/**
 * @file penaltyRules.js
 * @description 将《陕西省自然资源行政处罚裁量权实施基准（土地类）》转换为结构化的JavaScript数据。
 * 注意：
 * 1. 本文件已根据CSV内容进行扩充，包含了多种违法情形。
 * 2. 您可以继续按照此格式添加或修改规则。
 * 3. 面积单位已从“亩”转换为“平方米”以便于计算（1亩 ≈ 666.67平方米）。
 * 4. 新增了不同类型的罚款结构，如 `finePercentageOfIllegalIncome` 和 `fineAsMultipleOfReclamationFee`。
 */

// 1 亩 ≈ 666.67 平方米
const MU_TO_SQM = 666.67;

export const penaltyRules = [
  {
    // 对应“未批先建”
    id: 'illegal_land_occupation',
    name: '对未经批准或者采取欺骗手段骗取批准，非法占用土地的行政处罚',
    legalBasis: '【法律】\n1.《土地管理法》（2019年修正）第七十七条\n【行政法规】\n1.《土地管理法实施条例》（2021年修订）第五十七条',
    
    determineLevel: (details) => {
      const { area, landType = '其他土地' } = details;
      const areaInMu = area / MU_TO_SQM;

      if (landType === '基本农田') {
        if (areaInMu < 5) return '轻微';
        if (areaInMu >= 5 && areaInMu < 10) return '一般';
        return '严重';
      }
      if (landType === '耕地') { // 基本农田以外的耕地
        if (areaInMu < 10) return '轻微';
        if (areaInMu >= 10 && areaInMu < 20) return '一般';
        return '严重';
      }
      // 其他土地
      if (areaInMu < 20) return '轻微';
      if (areaInMu >= 20 && areaInMu < 40) return '一般';
      return '严重';
    },

    penalties: {
      '轻微': {
        description: '非法占用基本农田5亩以下；或非法占用基本农田以外的耕地10亩以下；或非法占用其他土地20亩以下。',
        actions: ['责令退还非法占用的土地', '限期15日内拆除在非法占用的土地上新建的建筑物和其他设施，恢复土地原状'],
        finePerSqm: { min: 100, max: 300 }, 
      },
      '一般': {
        description: '非法占用基本农田5亩以上10亩以下；或非法占用基本农田以外的耕地10亩以上20亩以下；或非法占用其他土地20亩以上40亩以下。',
        actions: ['责令退还非法占用的土地', '限期15日内拆除在非法占用的土地上新建的建筑物和其他设施，恢复土地原状'],
        finePerSqm: { min: 300, max: 600 },
      },
      '严重': {
        description: '非法占用基本农田10亩以上；或非法占用基本农田以外的耕地20亩以上；或非法占用其他土地40亩以上。',
        actions: ['责令退还非法占用的土地', '限期15日内拆除在非法占用的土地上新建的建筑物和其他设施，恢复土地原状'],
        finePerSqm: { min: 600, max: 1000 },
      }
    }
  },
  {
    // 对应“违规施工”的一种情况
    id: 'illegal_land_use_change',
    name: '对违反土地利用总体规划擅自将农用地改为建设用地的行政处罚',
    legalBasis: '【法律】\n1.《土地管理法》（2019年修正）第七十七条\n【行政法规】\n1.《土地管理法实施条例》（2021年修订）第五十七条',
    
    determineLevel: (details) => {
      const { area, landType = '耕地' } = details;
      const areaInMu = area / MU_TO_SQM;
      if (landType === '基本农田') {
         return '严重'; // 擅自改变基本农田用途，通常直接视为严重
      }
      if (areaInMu < 10) return '轻微';
      if (areaInMu >= 10 && areaInMu < 20) return '一般';
      return '严重';
    },

    penalties: {
      '轻微': {
        description: '擅自将基本农田以外的农用地改为建设用地，面积不满10亩。',
        actions: ['责令限期改正', '恢复土地原状'],
        finePerSqm: { min: 50, max: 100 }, 
        deadlineInDays: 30,
      },
      '一般': {
        description: '擅自将基本农田以外的农用地改为建设用地，面积在10亩至20亩之间。',
        actions: ['责令限期改正', '恢复土地原状'],
        finePerSqm: { min: 100, max: 150 },
        deadlineInDays: 20,
      },
      '严重': {
        description: '擅自将基本农田改为建设用地，或将其他农用地改为建设用地面积超过20亩。',
        actions: ['责令限期拆除在非法转让的土地上新建的建筑物和其他设施', '恢复土地原状'],
        finePerSqm: { min: 150, max: 200 },
        deadlineInDays: 15,
      }
    }
  },
  {
    // 新增：对应序号1 - 非法转让土地
    id: 'illegal_land_transfer',
    name: '对买卖或者以其他形式非法转让土地的行政处罚',
    legalBasis: '【法律】\n1.《土地管理法》（2019年修正）第七十四条\n【行政法规】\n1.《土地管理法实施条例》（2021年修订）第五十四条\n2.《基本农田保护条例》（2011年修订）第三十条第四项',
    
    // 注意：此处的等级判断需要UI提供“违法所得”作为输入
    determineLevel: (details) => {
      const { illegalIncome = 0 } = details;
      if (illegalIncome < 50000) return '轻微';
      if (illegalIncome >= 50000 && illegalIncome < 200000) return '一般';
      return '严重';
    },

    penalties: {
      '轻微': {
        description: '违法所得较小，社会危害程度较轻。',
        actions: ['没收违法所得', '限期拆除或没收新建建筑物'],
        finePercentageOfIllegalIncome: { min: 10, max: 20 },
      },
      '一般': {
        description: '违法所得数额较大，或造成一定社会影响。',
        actions: ['没收违法所得', '限期拆除或没收新建建筑物'],
        finePercentageOfIllegalIncome: { min: 20, max: 40 },
      },
      '严重': {
        description: '违法所得数额巨大，或涉及基本农田，或造成恶劣社会影响。',
        actions: ['没收违法所得', '限期拆除或没收新建建筑物'],
        finePercentageOfIllegalIncome: { min: 40, max: 50 },
      }
    }
  },
  {
    // 新增：对应序号3 - 农村村民非法占地建住宅
    id: 'illegal_housing_construction',
    name: '对农村村民未经批准或者采取欺骗手段骗取批准，非法占用土地建住宅的行政处罚',
    legalBasis: '【法律】\n1.《土地管理法》（2019年修正）第七十八条\n【行政法规】\n1.《土地管理法实施条例》（2021年修订）第五十八条',
    
    determineLevel: (details) => {
      const { landType = '其他土地' } = details;
      if (landType === '基本农田') return '严重';
      if (landType === '耕地') return '一般';
      return '轻微';
    },

    penalties: {
      '轻微': {
        description: '非法占用除耕地、基本农田以外的土地建住宅。',
        actions: ['责令退还非法占用的土地', '限期拆除在非法占用的土地上新建的房屋'],
        fine: 0, // 此项无罚款
      },
      '一般': {
        description: '非法占用耕地建住宅。',
        actions: ['责令退还非法占用的土地', '限期拆除在非法占用的土地上新建的房屋'],
        fine: 0,
      },
      '严重': {
        description: '非法占用基本农田建住宅。',
        actions: ['责令退还非法占用的土地', '限期拆除在非法占用的土地上新建的房屋'],
        fine: 0,
      }
    }
  },
  {
    // 新增：对应序号4 - 拒不履行土地复垦义务
    id: 'refusal_to_reclaim_land',
    name: '对拒不履行土地复垦义务的行政处罚',
    legalBasis: '【法律】\n1.《土地管理法》（2019年修正）第七十五条\n【行政法规】\n1.《土地管理法实施条例》（2021年修订）第四十四条、第五十六条',
    
    determineLevel: (details) => {
      const { area, landType = '其他土地' } = details;
      const areaInMu = area / MU_TO_SQM;
      if (landType === '基本农田') return '严重';
      if (landType === '耕地') {
        if (areaInMu < 5) return '轻微';
        if (areaInMu >= 5 && areaInMu < 10) return '一般';
        return '严重';
      }
      return '轻微'; // 假设其他土地为轻微
    },

    penalties: {
      '轻微': {
        description: '逾期不复垦，损毁耕地（除基本农田）5亩以下，或损毁其他土地。',
        actions: ['责令限期改正'],
        finePerSqm: { min: 100, max: 300 },
      },
      '一般': {
        description: '逾期不复垦，损毁耕地（除基本农田）5亩以上10亩以下。',
        actions: ['责令限期改正'],
        finePerSqm: { min: 300, max: 600 },
      },
      '严重': {
        description: '逾期不复垦，损毁基本农田，或损毁耕地（除基本农田）10亩以上。',
        actions: ['责令限期改正', '情节严重的，由主管部门代为完成，所需费用由违法者承担'],
        finePerSqm: { min: 600, max: 1000 },
      }
    }
  },
  {
    // 新增：对应序号5 - 临时土地上建永久建筑
    id: 'permanent_construction_on_temporary_land',
    name: '对在临时使用的土地上修建永久性建筑物、构筑物的行政处罚',
    legalBasis: '【行政法规】\n1.《土地管理法实施条例》（2021年修订）第四十六条',
    
    determineLevel: (details) => {
      const { landType = '其他土地' } = details;
      if (landType === '基本农田') return '严重';
      if (landType === '耕地') return '一般';
      return '轻微';
    },

    penalties: {
      '轻微': {
        description: '在除耕地、基本农田外的临时使用土地上修建永久建筑。',
        actions: ['责令限期拆除'],
        fine: 0,
      },
      '一般': {
        description: '在临时使用的耕地上修建永久建筑。',
        actions: ['责令限期拆除'],
        fine: 0,
      },
      '严重': {
        description: '在临时使用的基本农田上修建永久建筑。',
        actions: ['责令限期拆除'],
        fine: 0,
      }
    }
  },
  {
    // 新增：对应序号6 - 临时使用土地逾期未恢复
    id: 'failure_to_restore_temporary_land',
    name: '对临时使用土地期满未恢复土地原状的行政处罚',
    legalBasis: '【行政法规】\n1.《土地管理法实施条例》（2021年修订）第四十五条',
    
    // 注意：此处的等级判断和罚款计算都需要UI提供“土地复垦费”作为输入
    determineLevel: (details) => {
      const { area, landType = '其他土地' } = details;
      const areaInMu = area / MU_TO_SQM;
      if (landType === '基本农田') return '严重';
      if (landType === '耕地') {
        if (areaInMu < 5) return '轻微';
        if (areaInMu >= 5 && areaInMu < 10) return '一般';
        return '严重';
      }
      return '轻微';
    },

    penalties: {
      '轻微': {
        description: '逾期未恢复，损毁耕地（除基本农田）5亩以下，或损毁其他土地。',
        actions: ['责令限期改正'],
        fineAsMultipleOfReclamationFee: { min: 1, max: 1.2 },
      },
      '一般': {
        description: '逾期未恢复，损毁耕地（除基本农田）5亩以上10亩以下。',
        actions: ['责令限期改正'],
        fineAsMultipleOfReclamationFee: { min: 1.2, max: 1.5 },
      },
      '严重': {
        description: '逾期未恢复，损毁基本农田，或损毁耕地（除基本农田）10亩以上。',
        actions: ['责令限期改正'],
        fineAsMultipleOfReclamationFee: { min: 1.5, max: 2 },
      }
    }
  },
];