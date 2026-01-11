const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = 3000;

// Python API 地址配置
const PYTHON_API_URL = 'http://10.85.3.110:8000';

app.use(express.static('public'));
app.use(express.json());

// 1. 提交任务接口：接收 Excel -> 解析 URL -> 提交给 Python -> 返回 Task ID
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传 Excel 文件' });
        }

        const taskType = req.body.type || 'product';
        const pages = parseInt(req.body.pages) || 1;

        // 读取 Excel 文件
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // 将第一列转换为 JSON 数组 (假设第一列是 URL)
        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        // 扁平化并过滤空值，假设 URL 在每一行的第一个单元格
        let urls = jsonData.map(row => row[0]).filter(url => url && typeof url === 'string' && url.startsWith('http'));

        if (urls.length === 0) {
            return res.status(400).json({ error: '未在 Excel 中找到有效的 URL (需以 http 开头)' });
        }

        // 删除临时文件
        fs.unlinkSync(req.file.path);

        // 发送给 Python 服务
        const payload = {
            type: taskType,
            urls: urls,
            pages: pages
        };

        const pythonResponse = await axios.post(`${PYTHON_API_URL}/tasks`, payload);
        
        res.json(pythonResponse.data);

    } catch (error) {
        console.error('Task Submission Error:', error.message);
        res.status(500).json({ error: '提交任务失败: ' + (error.response?.data?.detail || error.message) });
    }
});

// 2. 状态查询代理接口
app.get('/api/status/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const response = await axios.get(`${PYTHON_API_URL}/tasks/${taskId}`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: '获取状态失败' });
    }
});

// 3. 结果下载接口：获取 JSON 结果 -> 转 Excel -> 下载
app.get('/api/download/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const response = await axios.get(`${PYTHON_API_URL}/tasks/${taskId}`);
        const data = response.data;

        if (data.status !== 'completed' || !data.results) {
            return res.status(400).send('任务未完成或无数据');
        }

        // 创建新的 Excel
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data.results);
        xlsx.utils.book_append_sheet(wb, ws, "Results");

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename="carrefour_data_${taskId}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Download Error:', error);
        res.status(500).send('生成文件失败');
    }
});

app.get('/api/template', (req, res) => {
    try {
        // 创建一个新的工作簿
        const wb = xlsx.utils.book_new();
        
        // 创建示例数据：第一行为标题（可选），第二行为示例 URL
        // 注意：之前的解析逻辑会过滤掉不以 http 开头的内容，所以加标题是安全的
        const templateData = [
            ["URL (必填)"], 
            ["https://www.carrefour.fr/p/sample-product-id"],
            ["https://www.carrefour.fr/r/sample-category"]
        ];

        // 将数据转换为 Sheet
        const ws = xlsx.utils.aoa_to_sheet(templateData);

        // 设置列宽（为了美观）
        ws['!cols'] = [{ wch: 50 }];

        // 将 Sheet 添加到工作簿
        xlsx.utils.book_append_sheet(wb, ws, "Template");

        // 生成 Buffer
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // 设置响应头，触发下载
        res.setHeader('Content-Disposition', 'attachment; filename="import_template.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (error) {
        console.error('Template Gen Error:', error);
        res.status(500).send('生成模板失败');
    }
});

app.listen(PORT, () => {
    console.log(`Node UI running at http://localhost:${PORT}`);
});