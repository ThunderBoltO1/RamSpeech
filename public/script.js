// Configuration
const CLIENT_ID = '271962080875-khc6aslq3phrnm9cqgguk37j0funtr7f.apps.googleusercontent.com';
const REDIRECT_URI = 'https://ram-speech.vercel.app';
const SPREADSHEET_ID = '1YY1a1drCnfXrSNWrGBgrMaMlFQK5rzBOEoeMhW9MYm8';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const CATEGORY_SHEETS = {
    'ทั่วไป': 'common',
    'ความต้องการ': 'need',
    'คลัง': 'storage',
};

// Variables
let accessToken = null;
let currentCategory = 'ทั่วไป';
let categoryWords = {};
let selectedWords = [];
let isSelectMode = false;
let isDragMode = true; // Set default drag mode to true
let draggedItem = null;
let draggedItemIndex = null;
let isDeleteMode = false; 

// DOM Elements
const elements = {
    modal: document.getElementById('modal'),
    buttonContainer: document.getElementById('button-container'),
    selectedWordsContainer: document.getElementById('selected-words-container'),
    mixResult: document.getElementById('mix-result'),
    newWordInput: document.getElementById('new-word-input')
};

// Drag and drop state is already defined above

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.category-button').forEach(button => {
        button.addEventListener('click', () => setCategory(button.dataset.category));
    });

    document.getElementById('btn-add').addEventListener('click', openModal);
    document.getElementById('btn-mix').addEventListener('click', toggleMixingMode);
    document.getElementById('btn-delete').addEventListener('click', deleteSelectedWord);
    document.getElementById('btn-drag').addEventListener('click', toggleDragMode);

    const cancelMixButton = document.getElementById('btn-cancel-mix');
    if (cancelMixButton) {
        cancelMixButton.addEventListener('click', cancelMixingMode);
    }

    const cancelDeleteButton = document.getElementById('btn-cancel-delete');
    if (cancelDeleteButton) {
        cancelDeleteButton.addEventListener('click', cancelDeleteMode);
    }

    const cancelDragButton = document.getElementById('btn-cancel-drag');
    if (cancelDragButton) {
        cancelDragButton.addEventListener('click', cancelDragMode);
    }

    handleAuthResponse();
});

// Authentication Functions
function handleAuthResponse() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    if (hashParams.has('access_token')) {
        processTokenResponse(hashParams);
    } else {
        checkLocalStorageToken();
    }
}

function processTokenResponse(params) {
    const storedState = localStorage.getItem('oauth_state');
    const state = params.get('state');
    
    if (state !== storedState) {
        showError('การตรวจสอบความปลอดภัยล้มเหลว');
        return;
    }
    
    accessToken = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in')) * 1000;
    tokenExpiry = Date.now() + expiresIn;
    
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('token_expiry', tokenExpiry);
    
    window.history.replaceState({}, document.title, window.location.pathname);
    loadInitialData();
}

function checkLocalStorageToken() {
    const token = localStorage.getItem('access_token');
    const expiry = localStorage.getItem('token_expiry');
    
    if (token && expiry && Date.now() < expiry) {
        accessToken = token;
        loadInitialData();
    } else {
        authenticate();
    }
}

function authenticate() {
    const state = Math.random().toString(36).substring(2);
    localStorage.setItem('oauth_state', state);
    
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(SCOPES)}&state=${state}`;
    window.location.href = authUrl;
}

// Data Functions
async function loadInitialData() {
    try {
        await loadCategoryData();
    } catch (error) {
        showError('ไม่สามารถโหลดข้อมูลเริ่มต้นได้');
    }
}

async function loadCategoryData() {
    const sheetName = CATEGORY_SHEETS[currentCategory];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?majorDimension=COLUMNS`;
    
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                showError('การยืนยันตัวตนล้มเหลว กรุณาล็อกอินใหม่');
                authenticate();
                return;
            }
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        const filteredWords = data.values ? data.values[0].filter(word => word && word.trim() !== '') : [];
        // Store words for this category
        categoryWords[currentCategory] = [...filteredWords];
        renderButtons(filteredWords);
    } catch (error) {
        console.error('Error loading category data:', error);
        showError('ไม่สามารถโหลดข้อมูลได้: ' + error.message);
        categoryWords[currentCategory] = [];
        renderButtons([]); // Render an empty state if the sheet is empty or an error occurs
    }
}

function renderButtons(words = []) {
    if (elements.buttonContainer) {
        // สร้าง HTML สำหรับปุ่มคำศัพท์ในแนวตั้ง
        elements.buttonContainer.innerHTML = words.map((word, index) => `
            <div class="word-item" data-index="${index}">
                <button class="word-button flex-1 text-center bg-blue-500 text-white text-4xl px-6 py-10 rounded-lg m-2 hover:bg-blue-600 transition-all draggable"
                        data-word="${word}" data-index="${index}" draggable="true" style="font-family: 'IBM Plex Sans Thai', sans-serif; font-size: 2.5rem; line-height: 1.5; word-wrap: break-word; white-space: normal; width: 100%;">
                    ${word}
                    ${isSelectMode ? `<span class="selection-indicator ml-2 text-green-500">${selectedWords.includes(word) ? '✔️' : ''}</span>` : ''}
                    <span class="drag-handle ml-2">↕️</span>
                </button>
            </div>
        `).join('');
        
        // เพิ่ม event listeners หลังจากสร้าง DOM elements
        document.querySelectorAll('.word-button').forEach(button => {
            button.addEventListener('click', () => {
                const word = button.getAttribute('data-word');
                if (isSelectMode) {
                    toggleWordSelection(word);
                } else if (!isDragMode) {
                    speakText(word);
                }
            });
            
            // Add drag and drop event listeners to all buttons by default
            button.addEventListener('dragstart', handleDragStart);
            button.addEventListener('dragover', handleDragOver);
            button.addEventListener('dragenter', handleDragEnter);
            button.addEventListener('dragleave', handleDragLeave);
            button.addEventListener('drop', handleDrop);
            button.addEventListener('dragend', handleDragEnd);
        });
    }
}

// UI Functions
// Update setCategory to not clear selectedWords when switching categories
function setCategory(category) {
    currentCategory = category;
    loadCategoryData();
}

// Modify toggleWordSelection to ensure words from different categories can be selected
function toggleWordSelection(word) {
    if (!isSelectMode) return;
    
    const index = selectedWords.indexOf(word);
    if (index > -1) {
        selectedWords.splice(index, 1);
    } else {
        selectedWords.push(word);
    }
    
    updateSelectionUI();
    updateMixResult();
    
    // Update selection indicators across all categories
    document.querySelectorAll('.word-button').forEach(button => {
        const buttonWord = button.getAttribute('data-word');
        const indicator = button.querySelector('.selection-indicator');
        if (indicator) {
            indicator.textContent = selectedWords.includes(buttonWord) ? '✔️' : '';
        }
    });
}

function updateSelectionUI() {
    if (elements.selectedWordsContainer) {
        elements.selectedWordsContainer.innerHTML = selectedWords.map(word => `
            <span class="selected-word bg-green-500 text-white text-xl px-4 py-2 rounded-full inline-flex items-center m-1">
                ${word}
                <button class="ml-2 hover:text-gray-200" onclick="removeSelectedWord('${word}')">&times;</button>
            </span>
        `).join('');
    }
}

// เพิ่มฟังก์ชันใหม่สำหรับลบคำจาก selected words
function removeSelectedWord(word) {
    const index = selectedWords.indexOf(word);
    if (index > -1) {
        selectedWords.splice(index, 1);
    }
    
    updateSelectionUI();
    updateMixResult();
    
    // อัปเดตเฉพาะสถานะการเลือกบนปุ่ม
    document.querySelectorAll('.word-button').forEach(button => {
        if (button.getAttribute('data-word') === word) {
            const indicator = button.querySelector('.selection-indicator');
            if (indicator) {
                indicator.textContent = '';
            }
        }
    });
}

function updateMixResult(text = '') {
    if (elements.mixResult) {
        elements.mixResult.textContent = text || selectedWords.join(' ') || 'ยังไม่ได้เลือกคำ';
    }
}

// Speech Functions
function speakText(text) {
    if (typeof responsiveVoice !== 'undefined') {
        responsiveVoice.speak(text, "Thai Male", "English  Male", {
            rate: 0.7, // Slow down the speech rate
            pitch: 0.8, // Slightly lower pitch for a more mature tone
            onstart: () => {
                console.log('เริ่มพูด:', text);
                highlightSpeakingButton(text);
            },
            onend: () => {
                console.log('พูดเสร็จสิ้น:', text);
                removeSpeakingHighlight();
            },
            onerror: (error) => {
                console.error('เกิดข้อผิดพลาดในการพูด:', error);
                showError('ไม่สามารถพูดข้อความได้');
            }
        });

        // แสดงข้อความที่พูดบน mix-result
        updateMixResult(text);
    } else {
        console.error('ResponsiveVoice.js ไม่พร้อมใช้งาน');
        showError('ไม่สามารถพูดข้อความได้');
    }
}

function highlightSpeakingButton(text) {
    document.querySelectorAll('.word-button').forEach(button => {
        if (button.getAttribute('data-word') === text) {
            button.classList.add('ring-4', 'ring-blue-300');
        }
    });
}

function removeSpeakingHighlight() {
    document.querySelectorAll('.word-button').forEach(button => {
        button.classList.remove('ring-4', 'ring-blue-300');
    });
}

// Modal Functions
function openModal() {
    elements.modal.classList.remove('hidden');
}

function closeModal() {
    elements.modal.classList.add('hidden');
    elements.newWordInput.value = '';
}

async function toggleMixingMode() {
    const cancelMixButton = document.getElementById('btn-cancel-mix');

    if (isSelectMode) {
        const mixedText = selectedWords.join(' ');
        if (mixedText.trim()) {
            speakText(mixedText);
            try {
                await saveMixedTextToStorage(mixedText); // Save mixed text to the storage sheet
                showToast('บันทึกคำผสมสำเร็จ!');
            } catch (error) {
                showError('เกิดข้อผิดพลาดในการบันทึกคำผสม: ' + error.message);
                console.error('Error saving mixed text:', error);
            }
            selectedWords = [];
            updateSelectionUI();
            updateMixResult();
        }
    }

    isSelectMode = !isSelectMode;
    updateMixingUI();

    // Show or hide the cancel mix button
    if (isSelectMode) {
        cancelMixButton.classList.remove('hidden');
    } else {
        cancelMixButton.classList.add('hidden');
    }

    loadCategoryData();
}

async function saveMixedTextToStorage(mixedText) {
    const sheetName = CATEGORY_SHEETS['คลัง']; // Use the 'storage' sheet
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A:A:append?valueInputOption=USER_ENTERED`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            values: [[mixedText]]
        })
    });

    if (!response.ok) {
        if (response.status === 401) {
            showError('การยืนยันตัวตนล้มเหลว กรุณาล็อกอินใหม่');
            authenticate();
            return;
        }
        throw new Error(`ไม่สามารถบันทึกข้อมูลได้: ${response.statusText}`);
    }
}

function cancelMixingMode() {
    isSelectMode = false;
    selectedWords = [];
    updateSelectionUI();
    updateMixResult();
    updateMixingUI();

    // Hide the cancel mix button
    document.getElementById('btn-cancel-mix').classList.add('hidden');
}

// Modify updateMixingUI to handle the cancel mix button
function updateMixingUI() {
    const mixButton = document.getElementById('btn-mix');
    

    if (isSelectMode) {
        mixButton.textContent = 'พูดคำผสม';
        mixButton.classList.remove('bg-purple-500');
        mixButton.classList.add('bg-green-500');

    
    } else {
        mixButton.textContent = 'ผสมคำ';
        mixButton.classList.remove('bg-green-500');
        mixButton.classList.add('bg-purple-500');

        
    }

    document.querySelectorAll('.category-button').forEach(button => {
        button.disabled = false;
        button.classList.remove('opacity-50');
    });
}

// Error Handling
function showError(message) {
    const errorToast = document.createElement('div');
    errorToast.className = 'fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg z-50';
    errorToast.textContent = message;
    
    document.body.appendChild(errorToast);
    
    setTimeout(() => {
        errorToast.remove();
    }, 5000);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Initialize
if (typeof responsiveVoice !== 'undefined') {
    responsiveVoice.setDefaultVoice("Thai Male , English Male");
}

// Drag mode is already enabled by default

// Drag and Drop Functions
function handleDragStart(e) {
    this.classList.add('dragging');
    draggedItem = this;
    draggedItemIndex = parseInt(this.getAttribute('data-index'));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedItem !== this) {
        const targetButton = this;
        const draggedWord = draggedItem.getAttribute('data-word');
        const targetWord = targetButton.getAttribute('data-word');
        
        // Only proceed if both words are in the selected words array
        if (selectedWords.includes(draggedWord) && selectedWords.includes(targetWord)) {
            // Get the current indices in the selectedWords array
            const draggedSelectedIndex = selectedWords.indexOf(draggedWord);
            const targetSelectedIndex = selectedWords.indexOf(targetWord);
            
            // Reorder within the selectedWords array
            selectedWords.splice(draggedSelectedIndex, 1);
            selectedWords.splice(targetSelectedIndex, 0, draggedWord);
            
            // Update the selection UI
            updateSelectionUI();
            
            // Show toast message
            showToast('เปลี่ยนลำดับคำที่เลือกเรียบร้อยแล้ว');
        }
    }
    
    return false;
}

function handleDragEnd(e) {
    document.querySelectorAll('.word-button').forEach(button => {
        button.classList.remove('dragging');
        button.classList.remove('drag-over');
    });
}

async function updateSheetOrder(category, words) {
    try {
        showToast('กำลังบันทึกการเปลี่ยนแปลงลำดับ...');
        
        const sheetName = CATEGORY_SHEETS[category];
        const sheetId = await getSheetId(sheetName);
        
        // Clear the sheet first
        const clearRequest = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "requests": [
                    {
                        "updateCells": {
                            "range": {
                                "sheetId": sheetId
                            },
                            "fields": "userEnteredValue"
                        }
                    }
                ]
            })
        };
        
        const clearResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, clearRequest);
        
        if (!clearResponse.ok) {
            throw new Error(`HTTP error! Status: ${clearResponse.status}`);
        }
        
        // Now update with the new order
        const updateRequest = {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "values": [words]
            })
        };
        
        const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?valueInputOption=RAW`, updateRequest);
        
        if (!updateResponse.ok) {
            throw new Error(`HTTP error! Status: ${updateResponse.status}`);
        }
        
        showToast('บันทึกการเปลี่ยนแปลงลำดับเรียบร้อยแล้ว');
    } catch (error) {
        console.error('Error updating sheet order:', error);
        showError('ไม่สามารถบันทึกการเปลี่ยนแปลงลำดับได้: ' + error.message);
    }
}

function toggleDragMode() {
    // Since drag mode is now always enabled, this function just toggles selection mode
    if (!isSelectMode) {
        isSelectMode = true;
        updateSelectionUI();
        showToast('กรุณาเลือกคำที่ต้องการจัดเรียงลำดับ');
        renderButtons(categoryWords[currentCategory] || []);
    } else {
        // If already in selection mode, just save the order
        if (selectedWords.length > 0) {
            saveSelectedWordsOrder();
        } else {
            // If no words are selected, show a message
            showToast('กรุณาเลือกคำที่ต้องการจัดเรียงลำดับก่อน');
        }
    }
}

function updateDragModeUI() {
    // Since drag mode is always enabled, this function now mainly handles selection mode UI
    const dragButton = document.getElementById('btn-drag');
    const cancelDragButton = document.getElementById('btn-cancel-drag');
    const saveOrderButton = document.getElementById('btn-save-order') || document.createElement('button');
    
    if (isSelectMode) {
        // Show save order button
        if (!document.getElementById('btn-save-order')) {
            saveOrderButton.id = 'btn-save-order';
            saveOrderButton.className = 'px-6 py-3 bg-green-500 text-white rounded-lg shadow-lg hover:bg-green-600 transition-all';
            saveOrderButton.innerHTML = '💾 บันทึกลำดับ';
            saveOrderButton.addEventListener('click', saveSelectedWordsOrder);
            
            const buttonContainer = document.querySelector('.fixed.bottom-4.right-4');
            if (buttonContainer) {
                buttonContainer.appendChild(saveOrderButton);
            }
        } else {
            saveOrderButton.classList.remove('hidden');
        }
        
        // Add selection mode indicator
        const header = document.querySelector('header h1');
        if (header) {
            header.textContent = '✅ โหมดเลือกคำ';
        }
    } else {
        // Hide save order button if it exists
        if (document.getElementById('btn-save-order')) {
            document.getElementById('btn-save-order').classList.add('hidden');
        }
        
        // Reset header text
        const header = document.querySelector('header h1');
        if (header) {
            header.textContent = 'ระบบสื่อสารด้วยเสียง';
        }
    }
}

function cancelDragMode() {
    // Drag mode is always enabled now, just cancel selection mode
    isSelectMode = false;
    selectedWords = [];
    updateDragModeUI();
    renderButtons(categoryWords[currentCategory] || []);
    showToast('ยกเลิกโหมดจัดเรียงลำดับแล้ว');
}

// Add New Word
async function addNewWord() {
    const newWord = elements.newWordInput.value.trim();
    
    if (!newWord) {
        showError('กรุณากรอกคำศัพท์');
        return;
    }

    // รวบรวมคำศัพท์ทั้งหมดจากปุ่มที่แสดงอยู่
    const words = Array.from(document.querySelectorAll('.word-button'))
                      .map(button => button.getAttribute('data-word'));
    
    if (words.includes(newWord)) {
        showError('คำนี้มีอยู่แล้วในระบบ');
        return;
    }

    try {
        await addWordToSheet(newWord, currentCategory);
        showToast('เพิ่มคำศัพท์สำเร็จ!');
        closeModal();
        loadCategoryData();
    } catch (error) {
        showError('เกิดข้อผิดพลาดในการบันทึกคำใหม่: ' + error.message);
        console.error('Error adding new word:', error);
    }
}

async function addWordToSheet(word, category) {
    const sheetName = CATEGORY_SHEETS[category];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}!A:A:append?valueInputOption=USER_ENTERED`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            values: [[word]]
        })
    });
    
    if (!response.ok) {
        if (response.status === 401) {
            showError('การยืนยันตัวตนล้มเหลว กรุณาล็อกอินใหม่');
            authenticate();
            return;
        }
        throw new Error(`ไม่สามารถบันทึกข้อมูลได้: ${response.statusText}`);
    }
}

// Delete Selected Words
function toggleDeleteMode() {
    isSelectMode = !isSelectMode;

    // Update the delete button text and style
    const deleteButton = document.getElementById('btn-delete');
    const cancelDeleteButton = document.getElementById('btn-cancel-delete');

    if (isSelectMode) {
        deleteButton.textContent = 'ยืนยันลบ';
        deleteButton.classList.remove('bg-red-500');
        deleteButton.classList.add('bg-yellow-500');
        cancelDeleteButton.classList.remove('hidden'); // Show cancel delete button
    } else {
        deleteButton.textContent = 'ลบ';
        deleteButton.classList.remove('bg-yellow-500');
        deleteButton.classList.add('bg-red-500');
        cancelDeleteButton.classList.add('hidden'); // Hide cancel delete button
        selectedWords = []; // Clear selected words when exiting delete mode
        updateSelectionUI();
        updateMixResult();
    }

    // Reload category data to show or hide selection indicators
    loadCategoryData();
}

// Add a function to handle canceling delete mode
function cancelDeleteMode() {
    if (isSelectMode) {
        toggleDeleteMode(); // Exit delete mode
    }
}

// Add event listener for the cancel delete button
document.getElementById('btn-cancel-delete').addEventListener('click', cancelDeleteMode);

// Add event listener for the cancel drag button
document.getElementById('btn-cancel-drag').addEventListener('click', cancelDragMode);

// Function to save the order of selected words to the sheet
async function saveSelectedWordsOrder() {
    if (selectedWords.length === 0) {
        showToast('ไม่มีคำที่เลือกไว้สำหรับจัดเรียง');
        return;
    }
    
    try {
        showToast('กำลังบันทึกการเปลี่ยนแปลงลำดับ...');
        
        const sheetName = CATEGORY_SHEETS[currentCategory];
        const allWords = categoryWords[currentCategory];
        
        // Create a new array with the selected words removed
        const nonSelectedWords = allWords.filter(word => !selectedWords.includes(word));
        
        // Create the final array with selected words in their new order
        const finalWordOrder = [...nonSelectedWords, ...selectedWords];
        
        // Update the sheet with the new order
        const updateRequest = {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "values": [finalWordOrder]
            })
        };
        
        const updateResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?valueInputOption=RAW`, updateRequest);
        
        if (!updateResponse.ok) {
            throw new Error(`HTTP error! Status: ${updateResponse.status}`);
        }
        
        // Update local data
        categoryWords[currentCategory] = finalWordOrder;
        
        // Exit drag mode
        isDragMode = false;
        isSelectMode = false;
        selectedWords = [];
        
        // Update UI
        updateDragModeUI();
        renderButtons(finalWordOrder);
        
        showToast('บันทึกการเปลี่ยนแปลงลำดับเรียบร้อยแล้ว');
    } catch (error) {
        console.error('Error updating sheet order:', error);
        showError('ไม่สามารถบันทึกการเปลี่ยนแปลงลำดับได้: ' + error.message);
    }
}

async function deleteSelectedWord() {
    if (!isSelectMode) {
        toggleDeleteMode(); // Enter select mode if not already in it
        return;
    }

    // Confirm deletion
    if (selectedWords.length === 0) {
        showError('ไม่มีคำที่เลือกไว้');
        return;
    }

    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบคำที่เลือกทั้งหมด?`)) {
        return;
    }

    try {
        // Delete selected words from Google Sheets
        for (const word of selectedWords) {
            await deleteWordFromSheet(word, currentCategory);
        }

        // Clear selected words
        selectedWords = [];

        // Exit delete mode
        toggleDeleteMode();

        // Reload data and update UI
        loadCategoryData();
        showToast('ลบคำที่เลือกสำเร็จ!');
    } catch (error) {
        showError('เกิดข้อผิดพลาดในการลบคำ: ' + error.message);
        console.error('Error deleting words:', error);
    }
}

async function deleteWordFromSheet(word, category) {
    const sheetName = CATEGORY_SHEETS[category];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`;

    // Fetch the row index of the word to delete
    const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?majorDimension=ROWS`;
    const getResponse = await fetch(getUrl, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!getResponse.ok) {
        throw new Error(`ไม่สามารถดึงข้อมูลได้: ${getResponse.statusText}`);
    }

    const data = await getResponse.json();
    const rowIndex = data.values.findIndex(row => row.includes(word));

    if (rowIndex === -1) {
        throw new Error(`ไม่พบคำที่ต้องการลบ: ${word}`);
    }

    // Prepare the batchUpdate request to delete the row
    const requestBody = {
        requests: [
            {
                deleteDimension: {
                    range: {
                        sheetId: await getSheetId(sheetName),
                        dimension: "ROWS",
                        startIndex: rowIndex,
                        endIndex: rowIndex + 1
                    }
                }
            }
        ]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        if (response.status === 401) {
            showError('การยืนยันตัวตนล้มเหลว กรุณาล็อกอินใหม่');
            authenticate();
            return;
        }
        throw new Error(`ไม่สามารถลบข้อมูลได้: ${response.statusText}`);
    }
}

async function getSheetId(sheetName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`ไม่สามารถดึงข้อมูล Sheet ID ได้: ${response.statusText}`);
    }

    const data = await response.json();
    const sheet = data.sheets.find(sheet => sheet.properties.title === sheetName);

    if (!sheet) {
        throw new Error(`ไม่พบ Sheet: ${sheetName}`);
    }

    return sheet.properties.sheetId;
} b