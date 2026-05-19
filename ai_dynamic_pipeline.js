const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// =================================================================
// [CONFIGURATION] ตั้งค่ารหัสการเชื่อมต่อระบบของคุณ
// =================================================================
const GITHUB_TOKEN = "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"; 
const REPO_OWNER = "opposite626262626-blip"; 
const REPO_NAME = "AI";                   
const BRANCH = "main";

const LOCAL_AI_HOST = "localhost";                       
const LOCAL_AI_PORT = 11434;                             
const AI_MODEL_NAME = "qwen2.5-coder";                   

// โฟลเดอร์ปลายทางที่จะบันทึกไฟล์ที่ประมวลผลเสร็จแล้ว
const OUTPUT_DIR = path.join(__dirname, 'compiled_source_output');

// =================================================================
// [INTERNAL SYSTEM] ตัวแปรและ Regex ควบคุมสากล
// =================================================================
const SUPPORTED_EXTENSIONS = /\.(c|h|asm|xml|manifest|class|java|json|cpp)$/i;

let fileQueue = [];               
let isDownloadingNext = false;    
let currentProcessingContent = ""; 
let USER_DYNAMIC_COMMAND = ""; // เก็บคำสั่งที่คุณพิมพ์ผ่าน Terminal สด ๆ

// ตั้งค่า Interface สำหรับพิมพ์โต้ตอบใน Terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// --- 1. เริ่มต้นระบบด้วยการรับคำสั่งสด ๆ จาก Terminal ---
function initSystem() {
    console.log("==================================================================");
    console.log("🤖  WELCOME TO AI DYNAMIC CORE ENGINE (DYNAMIC TERMINAL)  🤖");
    console.log(`📂 ผลลัพธ์ทั้งหมดจะถูกเขียนลงที่โฟลเดอร์: ${OUTPUT_DIR}`);
    console.log("==================================================================");
    
    // พิมพ์สั่งตรงนี้ได้เลยตามต้องการในแต่ละรอบที่รัน
    rl.question('💬 [Terminal Command] พิมพ์คำสั่งที่คุณต้องการสั่งให้ AI จัดการกับไฟล์: ', (command) => {
        if (!command.trim()) {
            console.log("❌ คำสั่งว่างเปล่า! ระบบยกเลิกการทำงาน");
            rl.close();
            process.exit(0);
        }
        
        USER_DYNAMIC_COMMAND = command;
        console.log(`\n🔒 รับคำสั่งเรียบร้อย: "${USER_DYNAMIC_COMMAND}"`);
        rl.close(); // ปิดการรับคำสั่งแล้วส่งเข้า Pipeline หลัก
        
        // เริ่มต้นค้นหาโครงสร้างไฟล์
        fetchGitHubTree();
    });
}

// --- 2. ตรวจสอบแผนผังโครงสร้างไฟล์จากคลัง GitHub ---
function fetchGitHubTree() {
    console.log("🔍 [1/4] กำลังเชื่อมต่อ API เพื่อสแกนแผนผังโครงสร้างไฟล์จาก GitHub...");
    
    const options = {
        hostname: 'api.github.com',
        path: `/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1`,
        headers: {
            'User-Agent': 'Acode-AI-Core-App',
            'Authorization': `Bearer ${GITHUB_TOKEN}`
        }
    };

    https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (res.statusCode === 200) {
                const tree = JSON.parse(data).tree || [];
                // กรองรายชื่อไฟล์หลากชนิดตามที่กำหนด
                fileQueue = tree
                    .filter(f => f.type === 'blob' && f.path.match(SUPPORTED_EXTENSIONS))
                    .map(f => f.path);
                
                console.log(`📦 [2/4] สแกนเสร็จสิ้น! เจอไฟล์ระบบเป้าหมายในคลัง: ${fileQueue.length} ไฟล์`);
                
                if (!fs.existsSync(OUTPUT_DIR)){
                    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
                }
                
                // เริ่มต้นการดึงและอ่านไฟล์สลับฟันปลา
                pipelineNext();
            } else {
                console.log(`❌ ดึงข้อมูลล้มเหลว (Status Code: ${res.statusCode}) ตรวจสอบโทเคนของคุณด้วยน้า`);
            }
        });
    });
}

// --- 3. ฟังก์ชันสตรีมดาวน์โหลดเนื้อหาไฟล์ (ระบบอ่านไฟล์ผ่านอินเทอร์เน็ต) ---
function downloadFile(filePath) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'raw.githubusercontent.com',
            path: `/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${filePath}`,
            headers: { 'User-Agent': 'Acode-AI-Core-App', 'Authorization': `Bearer ${GITHUB_TOKEN}` }
        };

        https.get(options, (res) => {
            let content = '';
            res.on('data', (chunk) => content += chunk);
            res.on('end', () => resolve(content));
        });
    });
}

// --- 4. ฟังก์ชันยิงคำสั่งสด + โค้ดที่อ่านได้ ส่งเข้าสมองกล AI ในเครื่อง ---
function callLocalAI(fileName, fileExt, codeContext) {
    return new Promise((resolve) => {
        console.log(`🤖 [AI Running] กำลังประมวลผลไฟล์ [${fileExt.toUpperCase()}] -> ${fileName}`);
        
        // ประกอบ Prompt แบบไดนามิกอิงตามคำสั่งที่คุณพิมพ์ลง Terminal สด ๆ
        const dynamicPrompt = 
            `You are a professional system development AI engine.\n` +
            `The master command you must follow for this file is: "${USER_DYNAMIC_COMMAND}"\n\n` +
            `CRITICAL PRODUCTION RULES:\n` +
            `1. Output ONLY valid, clean, and exact content suitable for the file extension.\n` +
            `2. Strictly DO NOT write markdown tags (like \`\`\`), conversational responses, or descriptions.\n` +
            `3. Ensure compilers or parsers can execute this output directly without syntax failure.\n\n` +
            `[Target File Name]: ${fileName}\n` +
            `[Target Extension]: ${fileExt}\n` +
            `[Current File Content]:\n${codeContext}`;

        const postData = JSON.stringify({
            model: AI_MODEL_NAME,
            prompt: dynamicPrompt,
            stream: false
        });

        const options = {
            hostname: LOCAL_AI_HOST,
            port: LOCAL_AI_PORT,
            path: '/api/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const aiResponse = JSON.parse(responseBody).response;
                    resolve(aiResponse);
                } else {
                    resolve(`// [Error] AI compilation failed with status ${res.statusCode}`);
                }
            });
        });

        req.on('error', () => {
            resolve(`/* Fallback Simulation */\n// System generated placeholder for ${fileName}`);
        });

        req.write(postData);
        req.end();
    });
}

// --- 5. ตัวควบคุมการอ่าน-เขียนและสลับฟันปลา (Pipeline Flow) ---
async function pipelineNext() {
    if (fileQueue.length === 0) {
        console.log("\n==================================================================");
        console.log("🏁 [Finish] ระบบประมวลผลตามคำสั่งใน Terminal ทำงานเสร็จสมบูรณ์ครบทุกลำดับ!");
        console.log(`📂 ตรวจสอบไฟล์ผลลัพธ์ที่สร้างใหม่ได้ที่โฟลเดอร์: ${OUTPUT_DIR}`);
        console.log("==================================================================");
        return;
    }

    const currentFile = fileQueue.shift();
    const fileExt = path.extname(currentFile).toLowerCase();
    
    console.log(`\n⚙️ [Reading File] กำลังโหลดไฟล์เข้าแรม: ${currentFile}`);

    // [จังหวะอ่านไฟล์]: ดึงเนื้อหาไฟล์ปัจจุบันเข้ามาเก็บไว้ในแรมเครื่องชั่วคราว
    currentProcessingContent = await downloadFile(currentFile);

    // [จังหวะสลับฟันปลาคู่ขนาน]: สั่งให้ระบบวิ่งไปแอบโหลดไฟล์ถัดไปรอไว้ล่วงหน้าในระหว่างที่ AI นั่งคิดงานไฟล์ปัจจุบัน
    let nextFilePromise = null;
    if (fileQueue.length > 0 && !isDownloadingNext) {
        isDownloadingNext = true;
        const nextFile = fileQueue[0];
        console.log(`⏳ [Parallel Stream] กำลังดึงข้อมูลไฟล์ถัดไปรอล่วงหน้า: ${nextFile}`);
        nextFilePromise = downloadFile(nextFile);
    }

    // ส่งคำสั่ง Terminal + เนื้อหาไฟล์ ให้ AI จัดระเบียบผลลัพธ์
    const aiOutputResult = await callLocalAI(currentFile, fileExt, currentProcessingContent);

    // [จังหวะเขียนไฟล์]: เอาผลลัพธ์บริสุทธิ์จาก AI มาบันทึกสร้างเป็นไฟล์จริงแยกตามโครงสร้างเดิม
    try {
        const finalOutputPath = path.join(OUTPUT_DIR, currentFile);
        const finalOutputDir = path.dirname(finalOutputPath);
        
        if (!fs.existsSync(finalOutputDir)){
            fs.mkdirSync(finalOutputDir, { recursive: true });
        }
        
        fs.writeFileSync(finalOutputPath, aiOutputResult, 'utf8');
        console.log(`💾 [Writing File Success] บันทึกไฟล์ที่สร้างใหม่ลงเครื่องสำเร็จ -> ${currentFile}`);
    } catch (err) {
        console.log(`❌ การเขียนไฟล์ระบบปลายทางขัดข้อง: ${err.message}`);
    }

    // เคลียร์คิวรอไฟล์ล่วงหน้าให้พร้อมทำงานรอบถัดไป
    if (nextFilePromise) {
        await nextFilePromise;
        isDownloadingNext = false;
    }

    // ขยับลูปสลับฟันปลาไปทำงานไฟล์ต่อไปทันทีอย่างไร้รอยต่อ
    pipelineNext();
}

// จุดสตาร์ทระบบควบคุมคอมมานด์ไลน์
initSystem();
               
