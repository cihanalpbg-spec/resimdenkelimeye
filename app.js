// Application State
let allWords = [];
let historyRecords = [];
let selectedImageBase64 = '';
let activeTab = 'list';

// Fetch voices once loaded
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
}

// On Page Load
document.addEventListener('DOMContentLoaded', () => {
    fetchWords();
    fetchHistory();
    
    // Close dropdowns on clicking elsewhere
    document.addEventListener('click', () => {
        document.querySelectorAll('.card-menu-dropdown').forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    });

    // Make sure SpeechSynthesis voices are loaded for Chrome/mobile browsers
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {};
    }
});

// ----------------------------------------------------
// TAB SYSTEM
// ----------------------------------------------------
function switchTab(tabId) {
    activeTab = tabId;
    
    // Manage Navbar Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Manage Tab Contents
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.remove('active');
    });
    const activeSec = document.getElementById(`sec-${tabId}`);
    if (activeSec) activeSec.classList.add('active');
    
    // Refresh Tab Data
    if (tabId === 'list') {
        fetchWords();
    } else if (tabId === 'archive') {
        fetchHistory();
    } else if (tabId === 'test') {
        exitTest(); // Reset test selection screen
    }
}

// ----------------------------------------------------
// LOCAL PERSISTENT STORAGE
// ----------------------------------------------------
function fetchWords() {
    try {
        const localData = localStorage.getItem('resimden_ingilizceye_words');
        allWords = localData ? JSON.parse(localData) : [];
        
        // Sort words alphabetically by English word (case-insensitive)
        allWords.sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
        
        renderWords(allWords);
    } catch (error) {
        console.error("Kelime listesi yüklenirken hata oluştu:", error);
        document.getElementById('words-container').innerHTML = 
            `<div class="chalk-loading">Yükleme hatası: Veriler okunamadı.</div>`;
    }
}

function fetchHistory() {
    try {
        const localData = localStorage.getItem('resimden_ingilizceye_history');
        historyRecords = localData ? JSON.parse(localData) : [];
        
        // Sort history by date descending (newest first)
        historyRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        renderHistory(historyRecords);
    } catch (error) {
        console.error("Çalışma geçmişi yüklenirken hata oluştu:", error);
        document.getElementById('archive-container').innerHTML = 
            `<div class="chalk-loading">Geçmiş yükleme hatası.</div>`;
    }
}

function saveWord(event) {
    event.preventDefault();
    const id = document.getElementById('form-word-id').value;
    const word = document.getElementById('form-word').value.trim();
    const pronunciation = document.getElementById('form-pronunciation').value.trim();
    const meaning = document.getElementById('form-meaning').value.trim();
    const technique = document.getElementById('form-technique').value.trim();

    if (!word || !meaning) {
        alert('Kelime ve Türkçe anlamı boş bırakılamaz.');
        return;
    }

    if (id) {
        // Edit Mode
        const index = allWords.findIndex(w => w.id === id);
        if (index > -1) {
            allWords[index] = {
                ...allWords[index],
                word,
                pronunciation,
                meaning,
                technique,
                updatedAt: new Date().toISOString()
            };
        }
    } else {
        // Add Mode
        // Avoid duplicate English words (case-insensitive check)
        const exists = allWords.find(w => w.word.toLowerCase() === word.toLowerCase());
        if (exists) {
            alert('Bu kelime zaten listenizde mevcut!');
            return;
        }

        const newWord = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
            word,
            pronunciation,
            meaning,
            technique,
            createdAt: new Date().toISOString()
        };
        allWords.push(newWord);
    }

    // Save to localStorage
    localStorage.setItem('resimden_ingilizceye_words', JSON.stringify(allWords));
    closeWordModal();
    fetchWords();
}

function deleteWord(id) {
    if (!confirm('Bu kelimeyi silmek istediğinize emin misiniz?')) return;
    
    allWords = allWords.filter(w => w.id !== id);
    localStorage.setItem('resimden_ingilizceye_words', JSON.stringify(allWords));
    fetchWords();
}

function logStudySession(testName, score, wordsStudied) {
    try {
        const record = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
            date: new Date().toISOString(),
            testName,
            score: score || 'N/A',
            wordsStudied: wordsStudied || []
        };
        historyRecords.push(record);
        localStorage.setItem('resimden_ingilizceye_history', JSON.stringify(historyRecords));
    } catch (error) {
        console.error('Çalışma geçmişi kaydedilemedi:', error);
    }
}

// ----------------------------------------------------
// SETTINGS & BACKUP (EXPORTS & IMPORTS)
// ----------------------------------------------------
function openSettingsModal() {
    const savedKey = localStorage.getItem('resimden_ingilizceye_apikey') || '';
    document.getElementById('settings-api-key').value = savedKey;
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

function saveSettings() {
    const key = document.getElementById('settings-api-key').value.trim();
    localStorage.setItem('resimden_ingilizceye_apikey', key);
    alert('Ayarlar kaydedildi.');
    closeSettingsModal();
}

function openBackupModal() {
    document.getElementById('backup-modal').style.display = 'flex';
}

function closeBackupModal() {
    document.getElementById('backup-modal').style.display = 'none';
}

function exportBackup() {
    const data = {
        words: allWords,
        history: historyRecords
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `resimden_ingilizceye_yedek_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function triggerBackupFile() {
    document.getElementById('backup-file-input').click();
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported.words) {
                throw new Error('Yedek dosyasında kelime verileri bulunamadı.');
            }
            
            if (confirm('Bu işlem mevcut tüm kelimelerinizi ve çalışma geçmişinizi silip yedek dosyasındakilerle değiştirecektir. Onaylıyor musunuz?')) {
                allWords = imported.words;
                historyRecords = imported.history || [];
                
                localStorage.setItem('resimden_ingilizceye_words', JSON.stringify(allWords));
                localStorage.setItem('resimden_ingilizceye_history', JSON.stringify(historyRecords));
                
                alert('Yedekten yükleme başarıyla tamamlandı!');
                closeBackupModal();
                fetchWords();
                fetchHistory();
            }
        } catch (error) {
            alert('Dosya yüklenemedi. Geçerli bir yedekleme dosyası (.json) seçtiğinizden emin olun. Hata: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// ----------------------------------------------------
// UI RENDERING: WORD LIST
// ----------------------------------------------------
function renderWords(words) {
    const container = document.getElementById('words-container');
    if (!words || words.length === 0) {
        container.innerHTML = `<div class="chalk-loading">Henüz kelime eklenmemiş. Üstteki "Resim Yükle" veya "+ Yeni Kelime" butonuna basarak ekleyin!</div>`;
        return;
    }

    container.innerHTML = words.map(item => {
        return `
            <div class="word-card" id="word-${item.id}">
                <div class="card-header-row">
                    <div class="word-english-group">
                        <span class="word-english" onclick="speakWord('${item.word.replace(/'/g, "\\'")}')">${item.word}</span>
                        <span class="speak-icon" onclick="speakWord('${item.word.replace(/'/g, "\\'")}')">🔊</span>
                    </div>
                    <div>
                        <button class="card-menu-btn" onclick="toggleDropdown(event, '${item.id}')">⋮</button>
                        <div class="card-menu-dropdown" id="dropdown-${item.id}">
                            <button class="menu-item" onclick="openEditModal('${item.id}')">Düzenle</button>
                            <button class="menu-item delete" onclick="deleteWord('${item.id}')">Sil</button>
                        </div>
                    </div>
                </div>
                ${item.pronunciation ? `<div class="word-pronunciation">(${item.pronunciation})</div>` : ''}
                <div class="word-meaning">${item.meaning}</div>
                ${item.technique ? `
                    <div class="word-technique-label">Hafıza Tekniği:</div>
                    <div class="word-technique">${item.technique}</div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function filterWords() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = allWords.filter(item => {
        return item.word.toLowerCase().includes(query) || 
               item.meaning.toLowerCase().includes(query) ||
               (item.pronunciation && item.pronunciation.toLowerCase().includes(query)) ||
               (item.technique && item.technique.toLowerCase().includes(query));
    });
    renderWords(filtered);
}

// Toggle edit / delete menus on card
function toggleDropdown(event, wordId) {
    event.stopPropagation();
    // Close other active dropdowns
    document.querySelectorAll('.card-menu-dropdown').forEach(dropdown => {
        if (dropdown.id !== `dropdown-${wordId}`) {
            dropdown.classList.remove('active');
        }
    });
    
    const dropdown = document.getElementById(`dropdown-${wordId}`);
    if (dropdown) dropdown.classList.toggle('active');
}

// ----------------------------------------------------
// MODAL MANAGEMENT
// ----------------------------------------------------
function openAddModal() {
    document.getElementById('form-word-id').value = '';
    document.getElementById('word-form').reset();
    document.getElementById('modal-title').innerText = 'Yeni Kelime Ekle';
    document.getElementById('word-modal').style.display = 'flex';
}

function openEditModal(id) {
    const wordItem = allWords.find(w => w.id === id);
    if (!wordItem) return;

    document.getElementById('form-word-id').value = wordItem.id;
    document.getElementById('form-word').value = wordItem.word;
    document.getElementById('form-pronunciation').value = wordItem.pronunciation || '';
    document.getElementById('form-meaning').value = wordItem.meaning;
    document.getElementById('form-technique').value = wordItem.technique || '';
    
    document.getElementById('modal-title').innerText = 'Kelime Düzenle';
    document.getElementById('word-modal').style.display = 'flex';
}

function closeWordModal() {
    document.getElementById('word-modal').style.display = 'none';
}

// ----------------------------------------------------
// AUDIO PRONUNCIATION ENGINE (SPEECH SYNTHESIS)
// ----------------------------------------------------
function speakWord(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop current speaking
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        
        // Find English voice
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(v => v.lang.startsWith('en'));
        if (enVoice) {
            utterance.voice = enVoice;
        }
        
        window.speechSynthesis.speak(utterance);
    } else {
        alert('Cihazınız ses telafuzunu desteklemiyor.');
    }
}

// ----------------------------------------------------
// IMAGE CAPTURE / UPLOAD (SCANNER WITH SERVERLESS FALLBACK)
// ----------------------------------------------------
function triggerFileInput() {
    document.getElementById('file-input').click();
}

function handleImageSelection(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        selectedImageBase64 = e.target.result;
        
        // Show preview
        document.getElementById('image-preview').src = selectedImageBase64;
        document.getElementById('dropzone').style.display = 'none';
        document.getElementById('preview-area').style.display = 'flex';
        document.getElementById('scan-results').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function resetUpload() {
    selectedImageBase64 = '';
    document.getElementById('file-input').value = '';
    document.getElementById('dropzone').style.display = 'flex';
    document.getElementById('preview-area').style.display = 'none';
    document.getElementById('scan-results').style.display = 'none';
}

async function processImageOCR() {
    if (!selectedImageBase64) return;

    // Show loading eraser animation
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('preview-area').style.display = 'none';

    const localApiKey = localStorage.getItem('resimden_ingilizceye_apikey');
    
    try {
        let extractedWords = [];

        if (localApiKey) {
            // Client-Side Direct call to Gemini API using custom api key
            console.log("Calling Gemini API directly from browser...");
            const match = selectedImageBase64.match(/^data:([^;]+);base64,(.+)$/);
            const mimeType = match ? match[1] : 'image/jpeg';
            const base64Data = match ? match[2] : selectedImageBase64;

            const systemInstruction = 
              `Extract all vocabulary items from this English learning textbook image. Each vocabulary entry contains:
1. English Word (Kelime) -> key 'word' (example: 'Abandon')
2. Turkish Pronunciation (Okunuşu) -> key 'pronunciation' (example: 'ıbandın')
3. Turkish Meaning (Türkçe Anlamı) -> key 'meaning' (example: 'Terk etmek')
4. Memory Technique (Hafıza Tekniği) -> key 'technique' (example: 'Topa çok abandığın halde kaleci kalesini terk etmedi.')

For each vocabulary item, parse these 4 parts exactly.
Return the output ONLY as a valid JSON array of objects.
Do NOT wrap the JSON output in markdown formatting blocks like \`\`\`json. Return pure JSON.`;

            const requestBody = {
              contents: [
                {
                  parts: [
                    { text: systemInstruction },
                    {
                      inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                      }
                    }
                  ]
                }
              ],
              generationConfig: {
                responseMimeType: 'application/json'
              }
            };

            // Call models
            const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
            let geminiResponseText = '';
            let apiError = null;

            for (const model of models) {
              try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${localApiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestBody)
                });

                const responseJson = await response.json();
                if (!response.ok) {
                  throw new Error(responseJson.error?.message || `HTTP ${response.status}`);
                }

                const text = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  geminiResponseText = text;
                  break;
                }
              } catch (err) {
                apiError = err;
              }
            }

            if (!geminiResponseText) {
                throw new Error(apiError ? apiError.message : 'Gemini API yanitsiz kaldi.');
            }

            extractedWords = JSON.parse(geminiResponseText.trim());

        } else {
            // Vercel Serverless Function Call
            console.log("Calling serverless api/upload endpoint...");
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: selectedImageBase64 })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Serverless OCR işlemi başarısız.');
            }
            extractedWords = data.words;
        }

        // Hide loader
        document.getElementById('loading-overlay').style.display = 'none';

        // Check and save parsed words
        if (extractedWords && extractedWords.length > 0) {
            const addedWords = [];
            
            extractedWords.forEach(item => {
                if (!item.word || !item.meaning) return;

                const cleanWord = item.word.trim();
                
                // Check if word exists
                const existingIndex = allWords.findIndex(w => w.word.toLowerCase() === cleanWord.toLowerCase());
                
                const newWord = {
                    id: existingIndex > -1 ? allWords[existingIndex].id : (Date.now().toString(36) + Math.random().toString(36).substring(2, 5) + Math.floor(Math.random() * 100)),
                    word: cleanWord,
                    pronunciation: (item.pronunciation || '').trim(),
                    meaning: item.meaning.trim(),
                    technique: (item.technique || '').trim(),
                    createdAt: new Date().toISOString()
                };

                if (existingIndex > -1) {
                    allWords[existingIndex] = newWord;
                } else {
                    allWords.push(newWord);
                }
                addedWords.push(newWord);
            });

            // Write back to localStorage
            localStorage.setItem('resimden_ingilizceye_words', JSON.stringify(allWords));

            // Render Scan Results List
            const listContainer = document.getElementById('scan-words-list');
            listContainer.innerHTML = '';
            
            addedWords.forEach(w => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="red-word">${w.word}</span> - (${w.pronunciation}) - ${w.meaning}`;
                listContainer.appendChild(li);
            });
            
            document.getElementById('scan-results').style.display = 'block';
        } else {
            alert('Resimde çözümlenebilecek kelime bulunamadı.');
            resetUpload();
        }

    } catch (error) {
        document.getElementById('loading-overlay').style.display = 'none';
        alert('Tarama Hatası: ' + error.message);
        resetUpload();
    }
}

// ----------------------------------------------------
// STUDY ARCHIVE HISTORY TIMELINE
// ----------------------------------------------------
function renderHistory(records) {
    const container = document.getElementById('archive-container');
    if (!records || records.length === 0) {
        container.innerHTML = `<div class="chalk-loading">Henüz bir çalışma kaydı bulunmuyor. Test Merkezindeki sınavlardan birini çözerek başlayın!</div>`;
        return;
    }

    container.innerHTML = records.map(rec => {
        const dateStr = new Date(rec.date).toLocaleString('tr-TR', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        
        const wordsStr = rec.wordsStudied && rec.wordsStudied.length > 0 
            ? rec.wordsStudied.join(', ') 
            : 'Belirtilmemiş';

        return `
            <div class="archive-card">
                <div class="archive-card-header">
                    <span class="archive-test-name">${rec.testName}</span>
                    <span class="archive-date">${dateStr}</span>
                    <span class="archive-score">Puan: ${rec.score}</span>
                </div>
                <div class="archive-words-label">Çalışılan Kelimeler:</div>
                <div class="archive-words">${wordsStr}</div>
            </div>
        `;
    }).join('');
}


// ----------------------------------------------------
// TEST CENTER GAMES
// ----------------------------------------------------
function exitTest() {
    document.getElementById('test-play-screen').style.display = 'none';
    document.getElementById('test-selector-screen').style.display = 'block';
    document.getElementById('game-arena').innerHTML = '';
}

function showGameArena() {
    document.getElementById('test-selector-screen').style.display = 'none';
    document.getElementById('test-play-screen').style.display = 'block';
}

function getTestWords(count = 10) {
    if (allWords.length === 0) return [];
    // Shuffle copy of list
    const shuffled = [...allWords].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

// Show standard test result chalk block
function showTestResult(testName, scoreText, studiedWords) {
    const arena = document.getElementById('game-arena');
    arena.innerHTML = `
        <div class="test-play-board">
            <div class="score-box">
                <h3 style="font-size:2rem;">Tebrikler! Test Tamamlandı</h3>
                <p>Başarı durumunuz karatahtaya işlendi:</p>
                <div class="score-number">${scoreText}</div>
                <button class="chalk-btn border-green margin-top" onclick="exitTest()">Tamamla</button>
            </div>
        </div>
    `;
    
    // Log to DB
    logStudySession(testName, scoreText, studiedWords);
}

// ----------------------------------------------------
// GAME 1: ADAM ASMACA (HANGMAN)
// ----------------------------------------------------
let hangmanState = {
    wordObj: null,
    hiddenWord: '',
    guessedLetters: [],
    errors: 0,
    maxErrors: 6,
    mode: 'en_to_tr', // en_to_tr or tr_to_en
    wordsQueue: [],
    wordsStudied: []
};

function startHangman() {
    if (allWords.length === 0) {
        alert('Test yapmak için önce kelime yüklemelisiniz!');
        return;
    }
    
    showGameArena();
    const arena = document.getElementById('game-arena');
    
    arena.innerHTML = `
        <h2 class="game-title">Adam Asmaca</h2>
        <div class="game-setup">
            <p>Oyun modunu seçin:</p>
            <div class="game-setup-row">
                <button class="chalk-btn border-green" onclick="initHangman('en_to_tr')">İngilizce Sor / Türkçe Anlamı İpucu</button>
                <button class="chalk-btn border-green" onclick="initHangman('tr_to_en')">Türkçe Sor / İngilizce İpucu</button>
            </div>
        </div>
    `;
}

function initHangman(mode) {
    hangmanState.mode = mode;
    hangmanState.wordsQueue = getTestWords(5); // 5 rounds of Hangman
    hangmanState.wordsStudied = hangmanState.wordsQueue.map(w => w.word);
    
    nextHangmanWord();
}

function nextHangmanWord() {
    if (hangmanState.wordsQueue.length === 0) {
        showTestResult('Adam Asmaca', 'Tamamlandı', hangmanState.wordsStudied);
        return;
    }
    
    const wordObj = hangmanState.wordsQueue.pop();
    hangmanState.wordObj = wordObj;
    hangmanState.guessedLetters = [];
    hangmanState.errors = 0;
    
    // Normalise targeted word string
    let targetStr = modeStringForHangman(wordObj);
    
    // Create hidden structure
    hangmanState.hiddenWord = targetStr.split('').map(c => {
        if (c === ' ' || c === '-' || c === '/') return c;
        return '_';
    }).join('');
    
    renderHangmanUI();
    drawHangmanCanvas();
}

function modeStringForHangman(wordObj) {
    // English word or Turkish meaning depending on mode
    if (hangmanState.mode === 'en_to_tr') {
        return wordObj.word.toUpperCase();
    } else {
        return wordObj.meaning.toUpperCase();
    }
}

function renderHangmanUI() {
    const arena = document.getElementById('game-arena');
    
    // Clue and text display
    let clueLabel = '';
    let clueText = '';
    
    if (hangmanState.mode === 'en_to_tr') {
        clueLabel = 'Türkçe Anlamı (İpucu):';
        clueText = hangmanState.wordObj.meaning;
    } else {
        clueLabel = 'İngilizce Kelime (İpucu):';
        clueText = hangmanState.wordObj.word;
    }
    
    // Render Keyboard buttons (Turkish letters included)
    const alphabet = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ-'.split('');
    const keyboardHTML = alphabet.map(letter => {
        const isUsed = hangmanState.guessedLetters.includes(letter);
        return `<button class="key-btn ${isUsed ? 'used' : ''}" onclick="guessHangmanLetter('${letter}')">${letter}</button>`;
    }).join('');
    
    const isRedClass = hangmanState.mode === 'en_to_tr' ? 'red-word' : '';
    
    arena.innerHTML = `
        <h2 class="game-title">Adam Asmaca</h2>
        <div class="test-play-board">
            <div class="hangman-layout">
                <!-- Canvas Left -->
                <div class="hangman-canvas-box">
                    <canvas id="hangman-canvas" width="180" height="200"></canvas>
                </div>
                
                <!-- Play Dashboard Right -->
                <div class="hangman-play-side">
                    <div class="hangman-clue-label">${clueLabel}</div>
                    <div class="hangman-clue">${clueText}</div>
                    
                    <!-- Display Spaces -->
                    <div class="hangman-word-dashes ${isRedClass}" id="hangman-word-spaces">
                        ${hangmanState.hiddenWord}
                    </div>
                    
                    <div class="hangman-keyboard">
                        ${keyboardHTML}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function guessHangmanLetter(letter) {
    if (hangmanState.guessedLetters.includes(letter)) return;
    hangmanState.guessedLetters.push(letter);
    
    const targetStr = modeStringForHangman(hangmanState.wordObj);
    
    if (targetStr.includes(letter)) {
        // Correct guess
        let newHidden = '';
        for (let i = 0; i < targetStr.length; i++) {
            if (targetStr[i] === letter) {
                newHidden += letter;
            } else {
                newHidden += hangmanState.hiddenWord[i];
            }
        }
        hangmanState.hiddenWord = newHidden;
        
        // Speak English word if user makes progress in en_to_tr mode
        if (hangmanState.mode === 'en_to_tr' && Math.random() > 0.6) {
            speakWord(hangmanState.wordObj.word);
        }
    } else {
        // Wrong guess
        hangmanState.errors++;
        drawHangmanCanvas();
    }
    
    // Check state
    const isWon = !hangmanState.hiddenWord.includes('_');
    const isLost = hangmanState.errors >= hangmanState.maxErrors;
    
    if (isWon) {
        speakWord(hangmanState.wordObj.word);
        setTimeout(() => {
            alert('Harika! Doğru Tahmin.');
            nextHangmanWord();
        }, 300);
    } else if (isLost) {
        setTimeout(() => {
            alert(`Maalesef Haklarınız Tükendi!\nCevap: ${targetStr}`);
            nextHangmanWord();
        }, 300);
    } else {
        renderHangmanUI();
        drawHangmanCanvas();
    }
}

// Draw chalk hangman on HTML Canvas
function drawHangmanCanvas() {
    const canvas = document.getElementById('hangman-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Chalk styling
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 2;
    ctx.shadowColor = '#fff';
    
    const error = hangmanState.errors;
    
    // 0. Base platform
    ctx.beginPath();
    ctx.moveTo(10, 190);
    ctx.lineTo(170, 190);
    ctx.stroke();
    
    // 1. Post
    if (error >= 1) {
        ctx.beginPath();
        ctx.moveTo(40, 190);
        ctx.lineTo(40, 20);
        ctx.stroke();
    }
    
    // 2. Beam
    if (error >= 2) {
        ctx.beginPath();
        ctx.moveTo(40, 20);
        ctx.lineTo(120, 20);
        ctx.moveTo(40, 50);
        ctx.lineTo(70, 20); // support brace
        ctx.stroke();
    }
    
    // 3. Rope
    if (error >= 3) {
        ctx.beginPath();
        ctx.moveTo(120, 20);
        ctx.lineTo(120, 50);
        ctx.stroke();
    }
    
    // 4. Head
    if (error >= 4) {
        ctx.beginPath();
        ctx.arc(120, 65, 15, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // 5. Spine/Body
    if (error >= 5) {
        ctx.beginPath();
        ctx.moveTo(120, 80);
        ctx.lineTo(120, 130);
        ctx.stroke();
        
        // Arms
        ctx.beginPath();
        ctx.moveTo(120, 95);
        ctx.lineTo(95, 110); // left arm
        ctx.moveTo(120, 95);
        ctx.lineTo(145, 110); // right arm
        ctx.stroke();
    }
    
    // 6. Legs
    if (error >= 6) {
        ctx.beginPath();
        ctx.moveTo(120, 130);
        ctx.lineTo(100, 165); // left leg
        ctx.moveTo(120, 130);
        ctx.lineTo(140, 165); // right leg
        ctx.stroke();
    }
}

// ----------------------------------------------------
// GAME 2: BOŞLUK DOLDURMA (FILL BLANKS)
// ----------------------------------------------------
let blanksState = {
    mode: 'en_to_tr', // en_to_tr or tr_to_en
    wordsQueue: [],
    currentWordObj: null,
    score: 0,
    totalQuestions: 5,
    wordsStudied: []
};

function startFillBlanks() {
    if (allWords.length === 0) {
        alert('Test yapmak için önce kelime yüklemelisiniz!');
        return;
    }
    
    showGameArena();
    const arena = document.getElementById('game-arena');
    
    arena.innerHTML = `
        <h2 class="game-title">Boşluk Doldurma</h2>
        <div class="game-setup">
            <p>Soru türünü seçin:</p>
            <div class="game-setup-row">
                <button class="chalk-btn border-green" onclick="initFillBlanks('en_to_tr')">İngilizce Sor / Türkçe Anlamını Yaz</button>
                <button class="chalk-btn border-green" onclick="initFillBlanks('tr_to_en')">Türkçe Sor / İngilizce Kelimeyi Yaz</button>
            </div>
        </div>
    `;
}

function initFillBlanks(mode) {
    blanksState.mode = mode;
    blanksState.wordsQueue = getTestWords(5);
    blanksState.score = 0;
    blanksState.totalQuestions = blanksState.wordsQueue.length;
    blanksState.wordsStudied = blanksState.wordsQueue.map(w => w.word);
    
    nextBlankQuestion();
}

function nextBlankQuestion() {
    if (blanksState.wordsQueue.length === 0) {
        showTestResult('Boşluk Doldurma', `${blanksState.score} / ${blanksState.totalQuestions}`, blanksState.wordsStudied);
        return;
    }
    
    blanksState.currentWordObj = blanksState.wordsQueue.pop();
    renderBlankUI();
}

function renderBlankUI() {
    const arena = document.getElementById('game-arena');
    const wordObj = blanksState.currentWordObj;
    
    let promptText = '';
    let clueLabel = '';
    let clueText = '';
    let isRed = false;
    
    if (blanksState.mode === 'en_to_tr') {
        promptText = wordObj.word;
        clueLabel = 'Okunuş İpucu:';
        clueText = wordObj.pronunciation ? `(${wordObj.pronunciation})` : 'Mevcut Değil';
        isRed = true;
    } else {
        promptText = wordObj.meaning;
        clueLabel = 'Hafıza Tekniği İpucu:';
        clueText = wordObj.technique || 'Mevcut Değil';
    }
    
    const progressText = `Soru: ${blanksState.totalQuestions - blanksState.wordsQueue.length} / ${blanksState.totalQuestions}`;
    
    arena.innerHTML = `
        <h2 class="game-title">Boşluk Doldurma</h2>
        <div class="test-play-board">
            <div style="font-size:1.15rem; color:#ccc;">${progressText}</div>
            
            <div class="fb-prompt-box ${isRed ? 'red-word' : ''}">
                ${promptText}
            </div>
            
            <div class="fb-clue">
                <strong>${clueLabel}</strong> ${clueText}
            </div>
            
            <div class="fb-input-area">
                <input type="text" id="fb-answer" class="fb-text-input" placeholder="Cevabınızı yazın..." autocomplete="off" autofocus>
                <button class="chalk-btn border-green" onclick="checkBlankAnswer()">Cevabı Kontrol Et</button>
            </div>
        </div>
    `;
    
    // Auto-focus and listen for Enter key
    const inputEl = document.getElementById('fb-answer');
    if (inputEl) {
        inputEl.focus();
        inputEl.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                checkBlankAnswer();
            }
        });
    }
}

function checkBlankAnswer() {
    const inputEl = document.getElementById('fb-answer');
    if (!inputEl) return;
    
    const userAnswer = inputEl.value.trim().toLowerCase();
    const wordObj = blanksState.currentWordObj;
    
    let isCorrect = false;
    let correctAnswer = '';
    
    if (blanksState.mode === 'en_to_tr') {
        correctAnswer = wordObj.meaning.trim().toLowerCase();
        
        // Flexible comparison for Turkish characters
        isCorrect = cleanString(userAnswer) === cleanString(correctAnswer) || 
                    correctAnswer.includes(userAnswer) && userAnswer.length > 2;
    } else {
        correctAnswer = wordObj.word.trim().toLowerCase();
        isCorrect = userAnswer === correctAnswer;
    }
    
    if (isCorrect) {
        blanksState.score++;
        speakWord(wordObj.word);
        alert('Doğru! Tebrikler.');
    } else {
        alert(`Yanlış!\nDoğru Cevap: ${blanksState.mode === 'en_to_tr' ? wordObj.meaning : wordObj.word}`);
    }
    
    nextBlankQuestion();
}

function cleanString(str) {
    return str.replace(/ı/g, 'i')
              .replace(/ğ/g, 'g')
              .replace(/ü/g, 'u')
              .replace(/ş/g, 's')
              .replace(/ö/g, 'o')
              .replace(/ç/g, 'c')
              .replace(/[-\s\.,\?\!\-\']/g, '');
}

// ----------------------------------------------------
// GAME 3: KART EŞLEŞTİRME (MATCHING CARDS)
// ----------------------------------------------------
let matchState = {
    cards: [],
    selectedCard: null,
    matchedCount: 0,
    startTime: null,
    wordsStudied: []
};

function startMatching() {
    if (allWords.length < 3) {
        alert('Eşleştirme oyunu oynamak için en az 3 kelime bulunmalıdır!');
        return;
    }
    
    showGameArena();
    initMatching();
}

function initMatching() {
    const numWords = Math.min(6, allWords.length);
    const chosenWords = getTestWords(numWords);
    matchState.wordsStudied = chosenWords.map(w => w.word);
    
    let cardDeck = [];
    
    chosenWords.forEach(w => {
        cardDeck.push({
            id: `en-${w.id}`,
            wordId: w.id,
            text: w.word,
            type: 'english'
        });
        cardDeck.push({
            id: `tr-${w.id}`,
            wordId: w.id,
            text: w.meaning,
            type: 'turkish'
        });
    });
    
    // Shuffle cards
    matchState.cards = cardDeck.sort(() => 0.5 - Math.random());
    matchState.selectedCard = null;
    matchState.matchedCount = 0;
    matchState.startTime = new Date();
    
    renderMatchingUI();
}

function renderMatchingUI() {
    const arena = document.getElementById('game-arena');
    
    const cardsHTML = matchState.cards.map((card, idx) => {
        return `
            <div class="match-card" id="card-${card.id}" onclick="clickMatchCard('${card.id}')">
                ${card.text}
            </div>
        `;
    }).join('');
    
    arena.innerHTML = `
        <h2 class="game-title">Kart Eşleştirme</h2>
        <div class="test-play-board">
            <p>Aynı anlamdaki İngilizce ve Türkçe kartları eşleştirin:</p>
            <div class="matching-board">
                ${cardsHTML}
            </div>
        </div>
    `;
}

function clickMatchCard(cardId) {
    const cardEl = document.getElementById(`card-${cardId}`);
    const clickedCard = matchState.cards.find(c => c.id === cardId);
    
    if (!clickedCard || cardEl.classList.contains('matched') || cardEl.classList.contains('selected')) return;
    
    cardEl.classList.add('selected');
    
    if (!matchState.selectedCard) {
        matchState.selectedCard = clickedCard;
        if (clickedCard.type === 'english') {
            speakWord(clickedCard.text);
        }
    } else {
        const firstCard = matchState.selectedCard;
        const secondCard = clickedCard;
        
        if (firstCard.wordId === secondCard.wordId && firstCard.type !== secondCard.type) {
            // Correct Match
            const firstEl = document.getElementById(`card-${firstCard.id}`);
            const secondEl = document.getElementById(`card-${secondCard.id}`);
            
            const wordObj = allWords.find(w => w.id === firstCard.wordId);
            if (wordObj) speakWord(wordObj.word);

            setTimeout(() => {
                firstEl.classList.add('matched');
                secondEl.classList.add('matched');
                firstEl.classList.remove('selected');
                secondEl.classList.remove('selected');
                
                matchState.matchedCount += 2;
                matchState.selectedCard = null;
                
                if (matchState.matchedCount === matchState.cards.length) {
                    const elapsed = Math.round((new Date() - matchState.startTime) / 1000);
                    showTestResult('Kart Eşleştirme', `${elapsed} saniye`, matchState.wordsStudied);
                }
            }, 300);
            
        } else {
            // Wrong Match
            const firstEl = document.getElementById(`card-${firstCard.id}`);
            const secondEl = document.getElementById(`card-${secondCard.id}`);
            
            firstEl.classList.add('incorrect');
            secondEl.classList.add('incorrect');
            
            setTimeout(() => {
                firstEl.classList.remove('selected', 'incorrect');
                secondEl.classList.remove('selected', 'incorrect');
                matchState.selectedCard = null;
            }, 800);
        }
    }
}

// ----------------------------------------------------
// GAME 4: 5 ŞIKLI TEST (MULTIPLE CHOICE)
// ----------------------------------------------------
let mcState = {
    mode: 'en_to_tr', // en_to_tr or tr_to_en
    wordsQueue: [],
    currentWordObj: null,
    score: 0,
    totalQuestions: 10,
    options: [],
    wordsStudied: []
};

function startMultipleChoice() {
    if (allWords.length === 0) {
        alert('Test yapmak için önce kelime yüklemelisiniz!');
        return;
    }
    
    showGameArena();
    const arena = document.getElementById('game-arena');
    
    arena.innerHTML = `
        <h2 class="game-title">5 Şıklı Test</h2>
        <div class="game-setup">
            <p>Soru ve Şık Türünü Seçin:</p>
            <div class="game-setup-row">
                <button class="chalk-btn border-green" onclick="initMultipleChoice('en_to_tr')">İngilizce Sor / Türkçe Şıklar</button>
                <button class="chalk-btn border-green" onclick="initMultipleChoice('tr_to_en')">Türkçe Sor / İngilizce Şıklar</button>
            </div>
        </div>
    `;
}

function initMultipleChoice(mode) {
    mcState.mode = mode;
    mcState.wordsQueue = getTestWords(10); // Ask up to 10 questions
    mcState.score = 0;
    mcState.totalQuestions = mcState.wordsQueue.length;
    mcState.wordsStudied = mcState.wordsQueue.map(w => w.word);
    
    nextMCQuestion();
}

function nextMCQuestion() {
    if (mcState.wordsQueue.length === 0) {
        showTestResult('5 Şıklı Test', `${mcState.score} / ${mcState.totalQuestions}`, mcState.wordsStudied);
        return;
    }
    
    mcState.currentWordObj = mcState.wordsQueue.pop();
    
    const current = mcState.currentWordObj;
    let distractorPool = allWords.filter(w => w.id !== current.id);
    
    distractorPool.sort(() => 0.5 - Math.random());
    const distractors = distractorPool.slice(0, Math.min(4, distractorPool.length));
    
    let optionsList = [];
    if (mcState.mode === 'en_to_tr') {
        optionsList.push({ wordId: current.id, text: current.meaning, isCorrect: true });
        distractors.forEach(w => {
            optionsList.push({ wordId: w.id, text: w.meaning, isCorrect: false });
        });
    } else {
        optionsList.push({ wordId: current.id, text: current.word, isCorrect: true });
        distractors.forEach(w => {
            optionsList.push({ wordId: w.id, text: w.word, isCorrect: false });
        });
    }
    
    // Shuffle choices
    mcState.options = optionsList.sort(() => 0.5 - Math.random());
    
    renderMCUI();
    
    if (mcState.mode === 'en_to_tr') {
        speakWord(current.word);
    }
}

function renderMCUI() {
    const arena = document.getElementById('game-arena');
    const wordObj = mcState.currentWordObj;
    
    let questionText = mcState.mode === 'en_to_tr' ? wordObj.word : wordObj.meaning;
    let isRed = mcState.mode === 'en_to_tr';
    const progressText = `Soru: ${mcState.totalQuestions - mcState.wordsQueue.length} / ${mcState.totalQuestions}`;
    
    const optionsHTML = mcState.options.map((opt, idx) => {
        const optionLabel = ['A', 'B', 'C', 'D', 'E'][idx] || '';
        return `
            <button class="mc-option-btn" id="option-${opt.wordId}" onclick="answerMCQuestion('${opt.wordId}', this)">
                <strong>${optionLabel})</strong> ${opt.text}
            </button>
        `;
    }).join('');
    
    arena.innerHTML = `
        <h2 class="game-title">5 Şıklı Test</h2>
        <div class="test-play-board">
            <div style="font-size:1.15rem; color:#ccc;">${progressText}</div>
            
            <div class="mc-question-box ${isRed ? 'red-word' : ''}">
                ${questionText}
                ${isRed ? `<span class="speak-icon" style="font-size:1.5rem; margin-left:10px;" onclick="speakWord('${wordObj.word.replace(/'/g, "\\'")}')">🔊</span>` : ''}
            </div>
            
            <div class="mc-options-list">
                ${optionsHTML}
            </div>
        </div>
    `;
}

function answerMCQuestion(chosenWordId, buttonEl) {
    const correctObj = mcState.currentWordObj;
    
    document.querySelectorAll('.mc-option-btn').forEach(btn => btn.disabled = true);
    
    const correctBtn = document.getElementById(`option-${correctObj.id}`);
    
    if (chosenWordId === correctObj.id) {
        buttonEl.classList.add('correct');
        mcState.score++;
        speakWord(correctObj.word);
    } else {
        buttonEl.classList.add('wrong');
        if (correctBtn) correctBtn.classList.add('correct');
    }
    
    setTimeout(() => {
        nextMCQuestion();
    }, 1500);
}
