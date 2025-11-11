const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const chartCanvas = document.getElementById('chart');
let chart;
let model;

// URL ของ Google Sheet Web App
const sheetURL = "YOUR_WEB_APP_URL_HERE"; // <-- แก้ตรงนี้

// กำหนดเลน/โซนตรวจจับ
const zones = [
    {name: 'Left Lane', xStart: 0, xEnd: 213},
    {name: 'Middle Lane', xStart: 214, xEnd: 426},
    {name: 'Right Lane', xStart: 427, xEnd: 640}
];

// เก็บจำนวนสะสม per zone
let zoneCounts = {};
zones.forEach(zone => {
    zoneCounts[zone.name] = { car:0, bus:0, truck:0, motorbike:0, person:0 };
});

// เก็บข้อมูลสำหรับ export CSV
let csvLog = [];

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

function setupChart() {
    const data = {
        labels: ['Car', 'Bus', 'Truck', 'Motorbike', 'Person'],
        datasets: zones.map((zone, i) => ({
            label: zone.name,
            data: [0,0,0,0,0],
            backgroundColor: ['#007bff','#28a745','#dc3545','#ffc107','#6c757d'].map(c => shadeColor(c, i*20))
        }))
    };
    chart = new Chart(chartCanvas, {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            animation: { duration: 0 },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// สีแตกต่างกันเล็กน้อย
function shadeColor(color, percent) {
    const f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent;
    const R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    const newColor = "#" + (0x1000000 + (Math.round((t-R)*p/100)+R)*0x10000 + (Math.round((t-G)*p/100)+G)*0x100 + (Math.round((t-B)*p/100)+B)).toString(16).slice(1);
    return newColor;
}

function getZone(x) {
    for (let zone of zones) {
        if (x >= zone.xStart && x <= zone.xEnd) return zone.name;
    }
    return 'Unknown';
}

// ส่งข้อมูลไป Google Sheets
function sendToSheet(zoneName, counts){
    fetch(sheetURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            zone: zoneName,
            car: counts.car,
            bus: counts.bus,
            truck: counts.truck,
            motorbike: counts.motorbike,
            person: counts.person
        })
    }).then(res => res.json())
    .then(data => console.log("Sheet response:", data))
    .catch(err => console.error("Error sending to sheet:", err));
}

// ดาวน์โหลด CSV
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

// main detection loop
let lastSent = 0;
const sendInterval = 3000; // ms

async function detectFrame() {
    if (!model) return;

    const predictions = await model.detect(video);

    // วาด video + zones
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(video,0,0,canvas.width,canvas.height);

    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2;
    zones.forEach(zone => {
        ctx.strokeRect(zone.xStart,0,zone.xEnd - zone.xStart,canvas.height);
        ctx.font = '16px Arial';
        ctx.fillStyle = 'blue';
        ctx.fillText(zone.name, zone.xStart+5, 20);
    });

    // reset frame counts
    let frameCounts = { car:0, bus:0, truck:0, motorbike:0, person:0 };

    predictions.forEach(pred => {
        const [x,y,width,height] = pred.bbox;
        ctx.strokeStyle = 'red';
        ctx.strokeRect(x,y,width,height);
        ctx.fillStyle = 'red';
        ctx.fillText(pred.class + ' ' + Math.round(pred.score*100)+'%', x, y>10?y-5:y+15);

        switch(pred.class){
            case 'car': frameCounts.car++; break;
            case 'bus': frameCounts.bus++; break;
            case 'truck': frameCounts.truck++; break;
            case 'motorcycle': frameCounts.motorbike++; break;
            case 'person': frameCounts.person++; break;
        }

        const zoneName = getZone(x + width/2);
        if(zoneName!=='Unknown'){
            switch(pred.class){
                case 'car': zoneCounts[zoneName].car++; break;
                case 'bus': zoneCounts[zoneName].bus++; break;
                case 'truck': zoneCounts[zoneName].truck++; break;
                case 'motorcycle': zoneCounts[zoneName].motorbike++; break;
                case 'person': zoneCounts[zoneName].person++; break;
            }
        }
    });

    // update frame counts on page
    document.getElementById('car').innerText = frameCounts.car;
    document.getElementById('bus').innerText = frameCounts.bus;
    document.getElementById('truck').innerText = frameCounts.truck;
    document.getElementById('motorbike').innerText = frameCounts.motorbike;
    document.getElementById('person').innerText = frameCounts.person;

    // update chart
    chart.data.datasets.forEach((dataset,i)=>{
        const zoneName = zones[i].name;
        dataset.data = [
            zoneCounts[zoneName].car,
            zoneCounts[zoneName].bus,
            zoneCounts[zoneName].truck,
            zoneCounts[zoneName].motorbike,
            zoneCounts[zoneName].person
        ];
    });
    chart.update();

    // send to sheet every interval
    const now = Date.now();
    if(now - lastSent > sendInterval){
        zones.forEach(zone=>{
            sendToSheet(zone.name, zoneCounts[zone.name]);
            // save to csv log
            const timestamp = new Date().toISOString();
            csvLog.push({
                Timestamp: timestamp,
                Zone: zone.name,
                Car: zoneCounts[zone.name].car,
                Bus: zoneCounts[zone.name].bus,
                Truck: zoneCounts[zone.name].truck,
                Motorbike: zoneCounts[zone.name].motorbike,
                Person: zoneCounts[zone.name].person
            });
        });
        lastSent = now;
    }

    requestAnimationFrame(detectFrame);
}

// start
async function main(){
    await setupCamera();
    await loadModel();
    setupChart();
    detectFrame();
}

main();

// event listener for CSV download
document.getElementById("downloadCSV").addEventListener("click", downloadCSVFile);
