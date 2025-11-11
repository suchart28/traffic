const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let model;

// ตัวแปรนับปัจจุบัน
let counts = { car: 0, bus: 0, truck: 0, motorbike: 0, person: 0 };

// ตัวแปรเก็บประวัติ (max 30 ค่า)
const history = { time: [], car: [], bus: [], truck: [], motorbike: [], person: [] };
const maxHistory = 30;

// ตั้งค่า Chart.js แบบ timeline
const ctxChart = document.getElementById('timelineChart').getContext('2d');
const timelineChart = new Chart(ctxChart, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'รถยนต์', data: [], borderColor: '#4e79a7', fill: false },
            { label: 'รถบัส', data: [], borderColor: '#f28e2c', fill: false },
            { label: 'รถบรรทุก', data: [], borderColor: '#e15759', fill: false },
            { label: 'มอเตอร์ไซค์', data: [], borderColor: '#76b7b2', fill: false },
            { label: 'คนเดินเท้า', data: [], borderColor: '#59a14f', fill: false }
        ]
    },
    options: {
        responsive: true,
        animation: { duration: 0 },
        scales: { y: { beginAtZero: true } }
    }
});

// เปิดกล้องเว็บแคม
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise((resolve) => {
        video.onloadedmetadata = () => resolve(video);
    });
}

// โหลดโมเดล Coco-SSD
async function loadModel() {
    model = await cocoSsd.load();
    console.log("Model loaded.");
}

// ตรวจจับวัตถุ
async function detectFrame() {
    if (!model) return;

    const predictions = await model.detect(video);

    // วาด video บน canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // รีเซ็ต counts
    counts = { car: 0, bus: 0, truck: 0, motorbike: 0, person: 0 };

    predictions.forEach(pred => {
        const [x, y, width, height] = pred.bbox;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, width, height);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'red';
        ctx.fillText(pred.class + ' ' + Math.round(pred.score * 100) + '%', x, y > 10 ? y-5 : y+15);

        switch(pred.class) {
            case 'car': counts.car++; break;
            case 'bus': counts.bus++; break;
            case 'truck': counts.truck++; break;
            case 'motorcycle': counts.motorbike++; break;
            case 'person': counts.person++; break;
        }
    });

    // อัปเดตตัวเลข
    document.getElementById('car').innerText = counts.car;
    document.getElementById('bus').innerText = counts.bus;
    document.getElementById('truck').innerText = counts.truck;
    document.getElementById('motorbike').innerText = counts.motorbike;
    document.getElementById('person').innerText = counts.person;

    requestAnimationFrame(detectFrame);
}

// อัปเดต timeline chart ทุก 1 วินาที
setInterval(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    history.time.push(timeStr);
    history.car.push(counts.car);
    history.bus.push(counts.bus);
    history.truck.push(counts.truck);
    history.motorbike.push(counts.motorbike);
    history.person.push(counts.person);

    // จำกัด history
    if (history.time.length > maxHistory) {
        history.time.shift();
        history.car.shift();
        history.bus.shift();
        history.truck.shift();
        history.motorbike.shift();
        history.person.shift();
    }

    // อัปเดตกราฟ
    timelineChart.data.labels = history.time;
    timelineChart.data.datasets[0].data = history.car;
    timelineChart.data.datasets[1].data = history.bus;
    timelineChart.data.datasets[2].data = history.truck;
    timelineChart.data.datasets[3].data = history.motorbike;
    timelineChart.data.datasets[4].data = history.person;
    timelineChart.update();
}, 1000);

// ฟังก์ชันสร้าง CSV
function generateCSV() {
    let csv = "Timestamp,เวลา,รถยนต์,รถบัส,รถบรรทุก,มอเตอร์ไซค์,คนเดินเท้า\n";
    for(let i = 0; i < history.time.length; i++) {
        const timestamp = new Date().toISOString();
        csv += `${timestamp},${history.time[i]},${history.car[i]},${history.bus[i]},${history.truck[i]},${history.motorbike[i]},${history.person[i]}\n`;
    }
    return csv;
}

// ฟังก์ชันดาวน์โหลด CSV
function downloadCSV(filename = "vehicle_history.csv") {
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ปุ่มดาวน์โหลด CSV
document.getElementById('downloadBtn').addEventListener('click', () => {
    downloadCSV(`vehicle_history_${new Date().toISOString()}.csv`);
});

// เริ่มแอป
async function main() {
    await setupCamera();
    await loadModel();
    detectFrame();
}

main();
