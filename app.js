const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let model;

// เก็บข้อมูลจำนวนวัตถุพร้อม timestamp
let csvLog = [];

// ตัวแปรสำหรับควบคุม interval การบันทึก
let lastSavedTime = 0;
const saveInterval = 2000; // 2 วินาที

async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise(resolve => {
        video.onloadedmetadata = () => resolve(video);
    });
}

async function loadModel() {
    model = await cocoSsd.load();
    console.log("Model loaded.");
}

// แปลงข้อมูลเป็น CSV และดาวน์โหลด
function downloadCSVFile() {
    if(csvLog.length === 0){
        alert("ไม่มีข้อมูลสำหรับดาวน์โหลด");
        return;
    }

    const headers = Object.keys(csvLog[0]).join(",");
    const rows = csvLog.map(obj => Object.values(obj).join(",")).join("\n");
    const csvContent = headers + "\n" + rows;

    const blob = new Blob([csvContent], {type: "text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "traffic_data.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ฟังก์ชันตรวจจับและอัปเดตทุก frame
async function detectFrame() {
    if (!model) return;

    const predictions = await model.detect(video);

    // วาด video
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(video,0,0,canvas.width,canvas.height);

    // นับจำนวนแต่ละประเภท
    let counts = { car:0, bus:0, truck:0, motorbike:0, person:0 };

    predictions.forEach(pred => {
        const [x,y,width,height] = pred.bbox;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(x,y,width,height);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'red';
        ctx.fillText(pred.class + ' ' + Math.round(pred.score*100)+'%', x, y>10?y-5:y+15);

        switch(pred.class){
            case 'car': counts.car++; break;
            case 'bus': counts.bus++; break;
            case 'truck': counts.truck++; break;
            case 'motorcycle': counts.motorbike++; break;
            case 'person': counts.person++; break;
        }
    });

    // อัปเดตตัวเลขบนหน้า
    document.getElementById('car').innerText = counts.car;
    document.getElementById('bus').innerText = counts.bus;
    document.getElementById('truck').innerText = counts.truck;
    document.getElementById('motorbike').innerText = counts.motorbike;
    document.getElementById('person').innerText = counts.person;

    // บันทึกข้อมูลทุก 2 วินาที
    const now = Date.now();
    if(now - lastSavedTime > saveInterval){
        const timestamp = new Date().toISOString();
        csvLog.push({
            Timestamp: timestamp,
            Car: counts.car,
            Bus: counts.bus,
            Truck: counts.truck,
            Motorbike: counts.motorbike,
            Person: counts.person
        });
        lastSavedTime = now;
    }

    requestAnimationFrame(detectFrame);
}

// เริ่มแอป
async function main(){
    await setupCamera();
    await loadModel();
    detectFrame();
}

// Event listener สำหรับดาวน์โหลด CSV
document.getElementById("downloadCSV").addEventListener("click", downloadCSVFile);

main();
