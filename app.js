const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let model;

// ตัวแปรนับปัจจุบัน
let counts = { car: 0, bus: 0, truck: 0, motorbike: 0, person: 0 };

// ตัวแปรเก็บประวัติ (max 30 ค่า)
const history = { time: [], car: [], bus: [], truck: [], motorbike: [], person: [] };
const maxHistory = 30;

// Tracking
let nextID = 0;
let trackedObjects = [];

// Chart.js timeline
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

// Open webcam
async function setupCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise(resolve => {
        video.onloadedmetadata = () => resolve(video);
    });
}

// Load Coco-SSD model
async function loadModel() {
    model = await cocoSsd.load();
    console.log("Model loaded.");
}

// IoU function for tracking
function iou(boxA, boxB) {
    const [xA, yA, wA, hA] = boxA;
    const [xB, yB, wB, hB] = boxB;
    const x1 = Math.max(xA, xB);
    const y1 = Math.max(yA, yB);
    const x2 = Math.min(xA + wA, xB + wB);
    const y2 = Math.min(yA + hA, yB + hB);
    const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const boxAArea = wA * hA;
    const boxBArea = wB * hB;
    return interArea / (boxAArea + boxBArea - interArea);
}

// Detect & Track
async function detectFrame() {
    if (!model) return;

    const predictions = await model.detect(video);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const newTrackedObjects = [];

    predictions.forEach(pred => {
        let matched = false;

        for (let obj of trackedObjects) {
            if (obj.class === pred.class && iou(obj.bbox, pred.bbox) > 0.5) {
                newTrackedObjects.push({
                    id: obj.id,
                    class: obj.class,
                    bbox: pred.bbox,
                    counted: obj.counted
                });
                matched = true;
                break;
            }
        }

        if (!matched) {
            newTrackedObjects.push({
                id: nextID++,
                class: pred.class,
                bbox: pred.bbox,
                counted: false
            });
        }
    });

    counts = { car: 0, bus: 0, truck: 0, motorbike: 0, person: 0 };

    newTrackedObjects.forEach(obj => {
        const [x, y, w, h] = obj.bbox;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'red';
        ctx.fillText(`${obj.class} ID:${obj.id}`, x, y > 10 ? y-5 : y+15);

        // นับวัตถุเฉพาะครั้งแรก
        if (!obj.counted) {
            counts[obj.class === 'motorcycle' ? 'motorbike' : obj.class]++;
            obj.counted = true;
        }
    });

    trackedObjects = newTrackedObjects;

    document.getElementById('car').innerText = counts.car;
    document.getElementById('bus').innerText = counts.bus;
    document.getElementById('truck').innerText = counts.truck;
    document.getElementById('motorbike').innerText = counts.motorbike;
    document.getElementById('person').innerText = counts.person;

    requestAnimationFrame(detectFrame);
}

// Update chart
setInterval(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    history.time.push(timeStr);
    history.car.push(counts.car);
    history.bus.push(counts.bus);
    history.truck.push(counts.truck);
    history.motorbike.push(counts.motorbike);
    history.person.push(counts.person);

    if (history.time.length > maxHistory) {
        history.time.shift();
        history.car.shift();
        history.bus.shift();
        history.truck.shift();
        history.motorbike.shift();
        history.person.shift();
    }

    timelineChart.data.labels = history.time;
    timelineChart.data.datasets[0].data = history.car;
    timelineChart.data.datasets[1].data = history.bus;
    timelineChart.data.datasets[2].data = history.truck;
    timelineChart.data.datasets[3].data = history.motorbike;
    timelineChart.data.datasets[4].data = history.person;
    timelineChart.update();
}, 1000);

// Generate CSV
function generateCSV() {
    let csv = "Timestamp,เวลา,รถยนต์,รถบัส,รถบรรทุก,มอเตอร์ไซค์,คนเดินเท้า\n";
    for(let i = 0; i < history.time.length; i++) {
        const timestamp = new Date().toISOString();
        csv += `${timestamp},${history.time[i]},${history.car[i]},${history.bus[i]},${history.truck[i]},${history.motorbike[i]},${history.person[i]}\n`;
    }
    return csv;
}

// Download CSV
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

// Button event
document.getElementById('downloadBtn').addEventListener('click', () => {
    downloadCSV(`vehicle_history_${new Date().toISOString()}.csv`);
});

// Start app
async function main() {
    await setupCamera();
    await loadModel();
    detectFrame();
}

main();
