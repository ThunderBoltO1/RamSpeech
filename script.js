// OAuth2
const CLIENT_ID = '271962080875-khc6aslq3phrnm9cqgguk37j0funtr7f.apps.googleusercontent.com';
const REDIRECT_URI = 'ram-speech.vercel.app';
const sheetId = "1YY1a1drCnfXrSNWrGBgrMaMlFQK5rzBOEoeMhW9MYm8";
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const API_KEY = 'AIzaSyCugN1kot7Nij2PWhKsP08I6yeHNgsYrQI';

let accessToken = '';  
let buttonsByCategory = {};
let currentCategory = "ทั่วไป";  
let selectedWords = [];  

// ฟังก์ชันเปิดโมดัลเพิ่มคำ
function openModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.remove('hidden');
    } else {
        console.error("ไม่พบ modal ใน HTML");
    }
}

// ฟังก์ชันปิดโมดัลเพิ่มคำ
function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

// ตรวจสอบ Token และโหลดข้อมูล
function checkAuthAndLoadData() {
    if (!accessToken) {
        console.error("Access token หายไป! โปรดยืนยันตัวตนใหม่");
        authenticate();
        return;
    }
    loadWordsForMixing();
}

// ฟังก์ชันยืนยันตัวตน
function authenticate() {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=${SCOPES}`;
    window.location.href = authUrl;
}

// ฟังก์ชันจัดการ Token
function handleAuthResponse() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    accessToken = params.get('access_token');
    if (accessToken) {
        console.log("Access Token:", accessToken);
        checkAuthAndLoadData();
    } else {
        alert("การยืนยันตัวตนล้มเหลว กรุณาลองใหม่");
        authenticate();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (window.location.hash.includes('access_token')) {
        handleAuthResponse();
    } else {
        authenticate();
    }
});

// ฟังก์ชันตั้งค่าหมวดหมู่
function setCategory(category) {
    currentCategory = category;
    loadWordsForMixing(); // โหลดข้อมูลคำใหม่ตามหมวดหมู่ที่เลือก
}

// ฟังก์ชันโหลดข้อมูลจาก Google Sheets
function loadWordsForMixing() {
    const wordButtonsContainer = document.getElementById('word-buttons-container');
    if (!wordButtonsContainer) {
        console.error('ไม่พบ container สำหรับปุ่มคำ!');
        return;
    }

    wordButtonsContainer.innerHTML = '';

    const categorySheet = currentCategory === "ทั่วไป" ? "common" :
                          currentCategory === "ความต้องการ" ? "need" :
                          currentCategory === "คลัง" ? "storage" : "common";

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${categorySheet}?key=${API_KEY}`;
    
    fetch(url, {
        method: "GET",
        headers: { "Authorization": `Bearer ${accessToken}` }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.values) {
            console.error("ไม่มีข้อมูลที่ได้รับจาก Google Sheets");
            return;
        }
        
        const words = data.values.map(row => row[0]);
        buttonsByCategory[currentCategory] = words;

        words.forEach(word => {
            let button = document.createElement("button");
            button.className = "px-4 py-2 bg-blue-500 text-white rounded-lg transition-all duration-300 hover:bg-blue-600 m-1";
            button.innerText = word;
            button.onclick = () => selectWordForMixing(word);
            wordButtonsContainer.appendChild(button);
        });
    })
    .catch(error => {
        console.error("ไม่สามารถโหลดข้อมูลจาก Google Sheets:", error);
        alert("ไม่สามารถโหลดข้อมูลจาก Google Sheets ได้");
    });
}

// ฟังก์ชันเลือกคำ
function selectWordForMixing(word) {
    if (selectedWords.includes(word)) {
        selectedWords = selectedWords.filter(w => w !== word);
    } else {
        selectedWords.push(word);
    }
    console.log("คำที่เลือก:", selectedWords);
}

// ฟังก์ชันเปิดโมดัลผสมคำ
function openMixModal() {
    const modal = document.getElementById('mix-modal');
    if (modal) {
        modal.classList.remove('hidden');
        loadWordsForMixing();
    } else {
        console.error("ไม่พบ mix-modal ใน HTML");
    }
}

// ฟังก์ชันปิดโมดัล
function closeMixModal() {
    document.getElementById('mix-modal').classList.add('hidden');
}