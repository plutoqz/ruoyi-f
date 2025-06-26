<template>
    <div class="panel-section report-panel">
        <h3 class="panel-title">分析与报告生成</h3>
        <p class="panel-description">
            基于<b>当前图谱</b>的数据，为特定业务场景生成报告。
        </p>

        <!-- Village-specific Reports -->
        <div class="action-item">
            <h4>村庄定制报告</h4>
            <p>为指定村庄生成一份包含多维度分析的详细Word报告。</p>
            <div class="input-group">
                <input type="text" v-model="reportVillageName" placeholder="请输入村庄名称" class="text-input" />
                <button @click="generateProtectionPlan" class="action-button main-report-button" :disabled="isReportLoading || !reportVillageName || !cytoscapeInstance">
                    {{ isReportLoading ? '生成中...' : '生成定制报告' }}
                </button>
            </div>
        </div>

        <!-- General / Multi-village Reports -->
        <div class="action-item">
            <h4>全域通用报告</h4>
             <p class="small-desc">为所有村庄生成预警报告或导出指标数据。</p>
            <div class="button-group">
                <button @click="generateComprehensiveWarningReport" class="action-button secondary-button" :disabled="isReportLoading || !cytoscapeInstance">
                    非粮化预警 (Word)
                </button>
                 <button @click="generateIndicatorExcel" class="action-button secondary-button" :disabled="isReportLoading || !cytoscapeInstance">
                    指标汇总 (Excel)
                </button>
            </div>
        </div>
        
         <p v-if="!cytoscapeInstance" class="warning-text">请先加载图谱数据以启用报告功能。</p>
    </div>
</template>

<script setup>
import { ref, defineProps } from 'vue';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ImageRun, HeadingLevel, AlignmentType } from 'docx';
import * as xlsx from 'xlsx';
import * as xlsxStyle from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import * as echarts from 'echarts';

// --- PROPS ---
const props = defineProps({
  cytoscapeInstance: { type: Object, default: null },
  currentTimeTag: { type: String, default: '' },
  previousTimeTag: { type: String, default: '202400' }
});

// --- COMPONENT STATE ---
const isReportLoading = ref(false);
const reportVillageName = ref('西经堂村');

// ============================================================================
// REPORT GENERATION LOGIC (Full-featured)
// ============================================================================

/**
 * Main function to generate the detailed protection plan for a single village.
 * This is the most comprehensive report.
 */

 //生成文档中的表格
function buildKeyValueTableTwoRows(obj) {
    const keyCells = [];
    const valueCells = [];

    if (!obj || typeof obj !== 'object') return [];

    for (const [key, value] of Object.entries(obj)) {
        if (value === null || value === undefined || typeof value === 'object') continue;
        keyCells.push(new TableCell({ children: [new Paragraph(String(key))] }));
        valueCells.push(new TableCell({ children: [new Paragraph(String(value))] }));
    }

    return [
        new TableRow({ children: keyCells }),
        new TableRow({ children: valueCells })
    ];
}
const generateProtectionPlan = async () => {
    if (!props.cytoscapeInstance || !reportVillageName.value) {
        alert('请先加载图谱并输入村庄名称。');
        return;
    }
    isReportLoading.value = true;

    try {
        const villageName = reportVillageName.value;
        const cy = props.cytoscapeInstance;
        const villageNode = cy.nodes(`[type="村"][name="${villageName}"]`).first();

        if (!villageNode.length) {
            alert(`在当前图谱中未找到村庄 "${villageName}"。`);
            isReportLoading.value = false;
            return;
        }

        // 1. Gather all necessary data from the graph
        const data = gatherDataForVillageReport(villageName);
        console.log(data);

        // 2. Generate required chart images in parallel
        const [comparisonChartImg, analysisChartImg] = await Promise.all([
            generateComparisonChartImage(data.comparisonData),
            generateAnalysisChartImage(data.analysisData)
        ]);

        // 3. Get rule-based suggestions
        const suggestions = getProtectionSuggestions(data.analysisData, data.comparisonData.changeRate);

        // 4. Build tables from raw key-value data (two-row layout)
        const comparisonTableRows = buildKeyValueTableTwoRows(data.comparisonData);
        const analysisTableRows = buildKeyValueTableTwoRows(data.analysisData);

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${villageName}耕地保护方案`, bold: true, size: 40 })] }),
                    new Paragraph({ text: `报告生成时间: ${new Date().toLocaleString()}`, alignment: AlignmentType.CENTER }),
                    new Paragraph(" "),
                    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("一、 耕地面积变化分析")] }),
                    new Paragraph({ children: [new ImageRun({ data: comparisonChartImg, transformation: { width: 550, height: 350 } })] }),
                    new Paragraph({ children: [new TextRun({ text: "图1：耕地保有量更新前后对比示意图", italics: true })], alignment: AlignmentType.CENTER }),
                    new Paragraph(data.comparisonData.summaryText || ""),
                    new Paragraph(" "),
                    ...(comparisonTableRows.length > 0 ? [new Table({ rows: comparisonTableRows, width: { size: 9000, type: WidthType.DXA } }), new Paragraph(" ")] : []),
                    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("二、 最新指标状态分析")] }),
                    new Paragraph({ children: [new ImageRun({ data: analysisChartImg, transformation: { width: 550, height: 300 } })] }),
                    new Paragraph({ children: [new TextRun({ text: "图2：更新后主要耕地指标分析图", italics: true })], alignment: AlignmentType.CENTER }),
                    new Paragraph(" "),
                    ...(analysisTableRows.length > 0 ? [new Table({ rows: analysisTableRows, width: { size: 9000, type: WidthType.DXA } }), new Paragraph(" ")] : []),
                    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("三、 保护措施建议")] }),
                    ...suggestions.map(s => new Paragraph({ text: s, bullet: { level: 0 } })),
                ],
            }],
        });

        // 5. Trigger download
        const blob = await Packer.toBlob(doc);
        saveAs(blob, `${villageName}_耕地保护方案_${props.currentTimeTag}.docx`);

    } catch (e) {
        alert(`报告生成失败: ${e.message}`);
        console.error(e);
    } finally {
        isReportLoading.value = false;
    }
};

/**
 * Generates and downloads the comprehensive warning report.
 */
const generateComprehensiveWarningReport = async () => {
    if (!props.cytoscapeInstance) { alert('图谱实例不存在。'); return; }
    isReportLoading.value = true;

    try {
        const cy = props.cytoscapeInstance;

        // -------- 1. 构建 pivoted 数据，与生成 Excel 部分保持一致 --------
        const pivoted = {};
        const indicators = new Set();
        cy.nodes(`[type="指标"][更新时间="${props.currentTimeTag}"]`).forEach(node => {
            const villageNode = node.incomers('edge[label="包含"]').sources().first();
            if (villageNode.length > 0) {
                const vName = villageNode.data('name');
                const indName = node.data('指标名称');
                const indVal = node.data('指标值');
                if (!pivoted[vName]) {
                    pivoted[vName] = { '村庄': vName };
                }
                pivoted[vName][indName] = indVal;
                indicators.add(indName);
            }
        });

        // -------- 2. 从 pivoted 中筛选需要预警的村庄 --------
        const warningResults = [];
        for (const [vName, rowData] of Object.entries(pivoted)) {
            let ratioRaw = parseFloat(rowData['非粮化比例'] ?? NaN);
            if (isNaN(ratioRaw)) continue;
            // 归一化：若大于1，则假设原始是百分比值（如 30 表示30%），除以100；否则假设已是小数表示
            const ratioNormalized = ratioRaw > 1 ? ratioRaw / 100 : ratioRaw;
            // 阈值 0.3 (即 30%)
            // if (ratioNormalized <= 0.3) continue;

            let areaRaw = parseFloat(rowData['非粮化面积'] ?? NaN);
            const areaVal = isNaN(areaRaw) ? 0 : areaRaw;

            warningResults.push({
                village: vName,
                ratio: ratioNormalized,
                area: areaVal
            });
        }

        if (warningResults.length === 0) {
            alert('分析完成：未发现需要预警的村庄。');
            isReportLoading.value = false;
            return;
        }

        // -------- 3. 生成全域预警概览图表 --------
        const mainChartImageData = await generateWarningChartImage(warningResults);

        // -------- 4. 生成表格行 --------
        const tableRows = warningResults.map(item => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph(item.village)] }),
                new TableCell({ children: [new Paragraph(item.area.toFixed(2))] }),
                new TableCell({ children: [new Paragraph((item.ratio * 100).toFixed(2))] }),
            ],
        }));
        // 插入表头
        tableRows.unshift(new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "村庄", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "非粮化面积(ha)", bold: true })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "非粮化比例(%)", bold: true })] })] }),
            ],
        }));

        // -------- 5. 静态建议列表 --------
        const suggestions = [
            "开展非粮化用地专项排查",
            "制定耕地恢复三年行动计划",
            "建立动态监测预警机制",
            "加强农业补贴政策引导",
            "实施土地流转限制措施"
        ].map(s => new Paragraph({ text: s, bullet: { level: 0 } }));

        // -------- 6. 组装 Document 的 sections --------
        const allSections = [];

        // 6.1 全域预警概览作为第一个 section
        const overviewChildren = [
            new Paragraph({ children: [new TextRun({ text: "耕地非粮化综合预警报告", bold: true, size: 40 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ text: " " }),
            new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "一、 全域预警概览" })] }),
            // 图表说明与图
            new Paragraph({ children: [new TextRun({ text: "图1：各非粮化预警分析图", italics: true })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new ImageRun({ data: mainChartImageData, transformation: { width: 550, height: 300 } })] }),
            new Paragraph({ text: " " }),
            new Paragraph({ children: [new TextRun({ text: "详细数据", bold: true })] }),
            new Table({ rows: tableRows, width: { size: 9000, type: WidthType.DXA } }),
            new Paragraph({ text: " " }),
            new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "二、 整体整治建议" })] }),
            ...suggestions,
        ];
        allSections.push({ children: overviewChildren });

        // 6.2 为每个预警村庄追加附录 section
        for (const item of warningResults) {
            const villageName = item.village;
            const villageSections = await generateSectionsForVillage(villageName, true);
            if (villageSections && villageSections.length > 0) {
                // 假设 generateSectionsForVillage 返回 [ { children: [...] } ]
                const secObj = villageSections[0];
                // 在附录部分前插入分页符
                // 方法一：在第一个 Paragraph 上设置 pageBreakBefore:
                if (secObj.children.length > 0) {
                    // 取第一个段落，如果它已有 text，可把 text 取出重建或直接插 pageBreakBefore 段
                    const first = secObj.children[0];
                    // 创建一个新的空 Paragraph 用于分页
                    const pbPara = new Paragraph({ pageBreakBefore: true, text: "" });
                    // 在 children 开头插入分页
                    secObj.children.unshift(pbPara);
                }
                allSections.push(secObj);
            }
        }

        // 7. 生成并下载 Word
        const doc = new Document({ sections: allSections });
        const blob = await Packer.toBlob(doc);
        saveAs(blob, "全域综合预警报告.docx");

    } catch (e) {
        alert(`报告生成失败: ${e.message}`);
        console.error(e);
    } finally {
        isReportLoading.value = false;
    }
};

/**
 * Generates and downloads an Excel sheet with indicator data.
 */
const generateIndicatorExcel = async () => {
    if (!props.cytoscapeInstance) { alert('图谱实例不存在。'); return; }
    isReportLoading.value = true;
    
    try {
        const cy = props.cytoscapeInstance;
        const pivoted = {};
        const indicators = new Set();
        const indicatorNodes = cy.nodes(`[type="指标"][更新时间="${props.currentTimeTag}"]`);

        indicatorNodes.forEach(node => {
            const villageNode = node.incomers('edge[label="包含"]').sources().first();
            if (villageNode.length > 0) {
                const villageName = villageNode.data('name');
                const indicatorName = node.data('指标名称');
                const indicatorValue = node.data('指标值');

                if (!pivoted[villageName]) {
                    pivoted[villageName] = { '村庄': villageName };
                }
                pivoted[villageName][indicatorName] = indicatorValue;
                indicators.add(indicatorName);
            }
        });
        const wideData = Object.values(pivoted);
        const headers = ['村庄', ...Array.from(indicators)];

        if (wideData.length === 0) {
            alert('未能在前端图谱中找到当前更新时间的指标数据。');
            isReportLoading.value = false;
            return;
        }

        const ws = xlsx.utils.json_to_sheet(wideData, { header: headers });
        const range = xlsx.utils.decode_range(ws['!ref']);
        for(let C = range.s.c; C <= range.e.c; ++C) {
            const address = xlsx.utils.encode_cell({r:0, c:C});
            if(!ws[address]) continue;
            ws[address].s = { font: { bold:true }, fill: { fgColor: { rgb: "FFD3D3D3" } } };
        }

        const wb = xlsxStyle.utils.book_new();
        xlsxStyle.utils.book_append_sheet(wb, ws, "耕地指标汇总");
        const wbout = xlsxStyle.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([wbout], {type:"application/octet-stream"}), "前端图谱指标数据.xlsx");

    } catch(e) {
        alert(`Excel文件生成失败: ${e.message}`);
        console.error(e);
    } finally {
        isReportLoading.value = false;
    }
};


function gatherDataForVillageReport(villageName) {
    const cy = props.cytoscapeInstance;
    const { currentTimeTag, previousTimeTag } = props;

    const pivoted = {};
    const indicators = new Set();
    const indicatorNodes = cy.nodes(`[type="指标"][更新时间="${props.currentTimeTag}"]`);

    indicatorNodes.forEach(node => {
        const villageNode = node.incomers('edge[label="包含"]').sources().first();
        if (villageNode.length > 0) {
            const villageName = villageNode.data('name');
            const indicatorName = node.data('指标名称');
            const indicatorValue = node.data('指标值');

            if (!pivoted[villageName]) {
                pivoted[villageName] = { '村庄': villageName };
            }
            pivoted[villageName][indicatorName] = indicatorValue;
            indicators.add(indicatorName);
        }
    });
    // const wideData = Object.values(pivoted);
    const rowData = pivoted[villageName];

    const oldTotal = parseFloat(rowData['耕地总面积']);
    const added = parseFloat(rowData['新增耕地面积']);
    const outflown = parseFloat(rowData['耕地流出面积']);
    const newTotal = oldTotal+added-outflown;
    const changeRate = oldTotal > 0 ? ((newTotal - oldTotal) / oldTotal) * 100 : 0;
    const analysisData = {};
    const headers = ['村庄', ...Array.from(indicators)]; // 这行代码您的代码里已经有了
    headers.forEach(columnName => {
        // rowData[columnName] 就能获取到对应列的值
        analysisData[columnName]=parseFloat(rowData[columnName])
        // console.log(`列名: ${columnName}, 值: ${rowData[columnName]}`);
    });
    
    // const getIndicatorValue = (vName, indicatorName, timeTag) => {
    //     const node = cy.nodes(`[权属单位="${vName}"][指标名称="${indicatorName}"][更新时间="${timeTag}"]`).first();
    //     return node.length ? parseFloat(node.data('指标值')) : 0.0;
    // };

    // const oldTotal = getIndicatorValue(villageName, '耕地总面积', previousTimeTag);
    // const newTotal = getIndicatorValue(villageName, '耕地总面积', currentTimeTag);
    // const added = getIndicatorValue(villageName, '新增耕地面积', currentTimeTag);
    // const outflown = getIndicatorValue(villageName, '耕地流出面积', currentTimeTag);
    // const changeRate = oldTotal > 0 ? ((newTotal - oldTotal) / oldTotal) * 100 : 0;

    // const analysisData = {};
    // cy.nodes(`[type="指标"][权属单位="${villageName}"][更新时间="${currentTimeTag}"]`).forEach(node => {
    //     analysisData[node.data('指标名称')] = parseFloat(node.data('指标值'));
    // });

    return {
        comparisonData: {
            oldTotal, newTotal, added, outflown, changeRate,
            summaryText: `耕地面积变化总结：\n• 更新前面积：${oldTotal.toFixed(2)}公顷\n• 更新后面积：${newTotal.toFixed(2)}公顷\n• 变化幅度：${changeRate.toFixed(1)}%`
        },
        analysisData
    };
}


/** Generates rule-based protection suggestions. */
function getProtectionSuggestions(indicators, changeRate) {
    const rules = [];
    if (indicators['耕地总面积'] < 900000) { // Example rule value
        rules.push(`严格落实耕地保有量红线，目前本村耕地保有量为${indicators['耕地总面积']?.toFixed(2)}公顷，未达到最低标准，请尽快进行土地整治！`);
    }
    if (indicators['土地垦殖率'] < 0.5) {
        rules.push(`耕种指数不应过低，目前为${indicators['土地垦殖率']?.toFixed(2)}，请尽快整改！`);
    }
    if (indicators['非粮化比例'] > 0.3) {
        rules.push(`非粮化比例超标，建议开展非粮化整治专项行动。`);
    }
    if (indicators['耕地破碎度'] > 10000) { // Example rule value
        rules.push(`耕地破碎度过高，建议推进耕地连片整治工程。`);
    }
    if (changeRate < -5) {
        rules.push(`紧急预警：检测到耕地面积大幅减少（变化率 ${changeRate.toFixed(1)}%），需立即开展土地复垦工作。`);
    }
    if (rules.length === 0) {
        rules.push('当前各项指标均在合理范围内，请继续保持。');
    }
    return rules;
}


// ============================================================================
// CHART IMAGE GENERATION HELPERS
// ============================================================================

/** Generates a waterfall-style comparison chart image. */
function generateComparisonChartImage(data) {
    const option = {
        title: { text: '耕地面积变化分析 (瀑布图)', left: 'center', top: 10 },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: ['期初', '新增', '流出', '期末'] },
        yAxis: { type: 'value', name: '面积 (公顷)' },
        series: [
            // {
            //     // Invisible base bar for positioning
            //     type: 'bar',
            //     stack: 'total',
            //     itemStyle: {
            //         borderColor: 'transparent',
            //         color: 'transparent'
            //     },
            //     data: [0, data.oldTotal, data.oldTotal + data.added - data.outflown, 0]
            // },
            {
                // Visible bars with individual colors
                type: 'bar',
                stack: 'total',
                label: { show: true, position: 'top' },
                data: [
                    data.oldTotal,
                    { value: data.added, itemStyle: { color: '#2ca02c' } }, // green for added
                    { value: -data.outflown, itemStyle: { color: '#d62728' } }, // red for outflow
                    data.newTotal
                ]
            }
        ]
    };
    return renderChartToImage(option, 1200, 700);
}


/** Generates a bar chart for current indicator analysis. */
function generateAnalysisChartImage(data) {
    const labels = Object.keys(data);
    const values = Object.values(data);
    const option = {
        title: { text: '最新耕地指标状态' },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, rotate: 30 } },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: values, label: { show: true, position: 'top', formatter: (p) => p.value.toFixed(2) } }]
    };
    return renderChartToImage(option, 1200, 600);
}

/** Generates a warning chart image. */
async function generateWarningChartImage(data) {
    const option = {
        title: { text: '非粮化预警' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['非粮化面积(ha)', '非粮化比例(%)'], top: 30 },
        grid: { top: 80, left: '8%', right: '8%', bottom: '15%', containLabel: true },
        xAxis: { type: 'category', data: data.map(d => d.village), axisLabel: { rotate: 30 } },
        yAxis: [
            { type: 'value', name: '非粮化面积(ha)' },
            { type: 'value', name: '非粮化比例(%)', axisLabel: { formatter: '{value} %' } }
        ],
        series: [
            { name: '非粮化面积(ha)', type: 'bar', data: data.map(d => d.area), itemStyle: { color: '#ff9999' } },
            { name: '非粮化比例(%)', type: 'line', yAxisIndex: 1, data: data.map(d => d.ratio * 100), itemStyle: { color: '#d62728' } }
        ],
        backgroundColor: '#ffffff'
    };
    return renderChartToImage(option, 1200, 650);
}


/** Generic function to render an ECharts option to a Base64 image data URL. */
async function renderChartToImage(option, width, height) {
    return new Promise((resolve, reject) => {
        const chartContainer = document.createElement('div');
        chartContainer.style.cssText = `width:${width}px; height:${height}px; position:absolute; left:-9999px;`;
        document.body.appendChild(chartContainer);
        try {
            const chart = echarts.init(chartContainer);
            chart.setOption({ ...option, animation: false, backgroundColor: '#ffffff' });
            setTimeout(() => {
                const dataUrl = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
                chart.dispose();
                document.body.removeChild(chartContainer);
                resolve(dataUrl.split(",")[1]);
            }, 500);
        } catch (err) {
            document.body.removeChild(chartContainer);
            reject(err);
        }
    });
}



async function generateSectionsForVillage(villageName, isAppendix = false) {
    const cy = props.cytoscapeInstance;
    const villageNode = cy.nodes(`[type="村"][name="${villageName}"]`).first();

    if (!villageNode.length) {
        if (!isAppendix) alert(`在当前图谱中未找到村庄 "${villageName}"。`);
        console.warn(`Could not find village ${villageName} for report generation.`);
        return null;
    }
    
    const data = gatherDataForVillageReport(villageName);
    const [comparisonChartImg, analysisChartImg] = await Promise.all([
        generateComparisonChartImage(data.comparisonData),
        generateAnalysisChartImage(data.analysisData)
    ]);
    const suggestions = getProtectionSuggestions(data.analysisData, data.comparisonData.changeRate);
    
    const titleHeading = isAppendix ? HeadingLevel.HEADING_1 : HeadingLevel.TITLE;
    const sectionHeading = isAppendix ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1;

    return [{
        children: [
            new Paragraph({ heading: titleHeading, children: [new TextRun(isAppendix ? `附录：${villageName} 详细分析` : `${villageName}耕地保护方案` )], alignment: isAppendix ? AlignmentType.LEFT : AlignmentType.CENTER }),
            new Paragraph({ text: isAppendix ? "" : `报告生成时间: ${new Date().toLocaleString()}`, alignment: AlignmentType.CENTER }),
            new Paragraph(" "),
            new Paragraph({ heading: sectionHeading, children: [new TextRun("耕地面积变化分析")] }),
            new Paragraph({ children: [new ImageRun({ data: comparisonChartImg, transformation: { width: 550, height: 350 } })] }),
            new Paragraph({ children: [new TextRun({ text: "图：耕地保有量更新前后对比示意图", italics: true })], alignment: AlignmentType.CENTER }),
            new Paragraph(data.comparisonData.summaryText),
            new Paragraph(" "),
            new Paragraph({ heading: sectionHeading, children: [new TextRun("最新指标状态分析")] }),
            new Paragraph({ children: [new ImageRun({ data: analysisChartImg, transformation: { width: 550, height: 300 } })] }),
            new Paragraph({ children: [new TextRun({ text: "图：更新后主要耕地指标分析图", italics: true })], alignment: AlignmentType.CENTER }),
            new Paragraph(" "),
            new Paragraph({ heading: sectionHeading, children: [new TextRun("保护措施建议")] }),
            ...suggestions.map(s => new Paragraph({ text: s, bullet: { level: 0 } })),
        ],
    }];
}
</script>

<style scoped>
/* All styles from previous version are fine */
.report-panel { border-top: 2px solid #3b82f6; }
.panel-section, .action-item { padding: 12px; border-radius: 8px; background-color: #fdfdff; border: 1px solid #e0e4e8; margin-top: 10px; }
.panel-title { margin: 0 0 12px 0; color: #1a232f; font-size: 1.2em; font-weight: 600; }
.panel-description { font-size: 0.85em; color: #606a77; margin-bottom: 15px; line-height: 1.4; }
.action-item h4 { margin: 0 0 8px 0; font-size: 1em; font-weight: 500; color: #333; }
.action-item p { font-size: 0.8em; color: #777; margin: 0 0 10px 0; }
.action-button { color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-size: 0.9em; width: 100%; display: inline-flex; align-items: center; justify-content: center; }
.action-button:disabled { background-color: #9ca3af; cursor: not-allowed; }
.main-report-button { background-color: #3b82f6; }
.secondary-button { background-color: #10b981; }
.button-group { display: flex; gap: 10px; }
.input-group { display: flex; }
.text-input { width: 100%; padding: 8px; border: 1px solid #c5cdd6; border-radius: 5px 0 0 5px; font-size: 0.9em; box-sizing: border-box; margin-bottom: 0; color: #1a232f;}
.input-group .action-button { border-radius: 0 5px 5px 0; width: auto; flex-shrink: 0; }
.warning-text { font-size: 0.8em; color: #d9534f; text-align: center; margin-top: 15px; }
.small-desc { font-size: 0.85em !important; color: #666 !important; margin-bottom: 10px !important; }
</style>
