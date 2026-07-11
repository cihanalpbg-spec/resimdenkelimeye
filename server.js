const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

// Enable CORS and increase body size limit for base64 images
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files from root folder
app.use(express.static(__dirname));

const WORDS_FILE = path.join(__dirname, 'words.json');
const HISTORY_FILE = path.join(__dirname, 'history.json');
const API_KEY_PATH = 'C:\\Users\\bahad\\.gemini\\antigravity-ide\\scratch\\api_key.txt';

const LANG_MAP = {
  'İngilizce': 'english',
  'Almanca': 'german',
  'Rusça': 'russian',
  'Japonca': 'japanese',
  'Fransızca': 'french',
  'İspanyolca': 'spanish'
};

function getLangKey(req) {
  const langQuery = req.query.lang;
  if (langQuery) return langQuery.toLowerCase();
  
  const langBody = req.body.language;
  if (langBody) {
    const mapped = LANG_MAP[langBody] || LANG_MAP[langBody.trim()];
    if (mapped) return mapped;
    const norm = langBody.toLowerCase();
    if (norm.includes('ing') || norm.includes('eng')) return 'english';
    if (norm.includes('alm') || norm.includes('ger')) return 'german';
    if (norm.includes('rus')) return 'russian';
    if (norm.includes('jap')) return 'japanese';
    if (norm.includes('fra') || norm.includes('fre')) return 'french';
    if (norm.includes('isp') || norm.includes('spa')) return 'spanish';
  }
  return 'english'; // Default
}

function getDatabasePath(type, lang) {
  const safeLang = (lang || 'english').replace(/[^a-z0-9_]/gi, '').toLowerCase();
  
  if (type === 'words') {
    const specificPath = path.join(__dirname, `words_${safeLang}.json`);
    const defaultPath = path.join(__dirname, 'words.json');
    if (safeLang === 'english' && !fs.existsSync(specificPath) && fs.existsSync(defaultPath)) {
      try {
        fs.copyFileSync(defaultPath, specificPath);
        console.log('Migrated old words.json to words_english.json');
      } catch (err) {
        console.error('Failed to migrate words.json:', err);
      }
    }
    return specificPath;
  } else if (type === 'history') {
    const specificPath = path.join(__dirname, `history_${safeLang}.json`);
    const defaultPath = path.join(__dirname, 'history.json');
    if (safeLang === 'english' && !fs.existsSync(specificPath) && fs.existsSync(defaultPath)) {
      try {
        fs.copyFileSync(defaultPath, specificPath);
        console.log('Migrated old history.json to history_english.json');
      } catch (err) {
        console.error('Failed to migrate history.json:', err);
      }
    }
    return specificPath;
  }
  return path.join(__dirname, `${type}.json`);
}

// Read API Key from user's system path
let geminiApiKey = '';
try {
  if (fs.existsSync(API_KEY_PATH)) {
    geminiApiKey = fs.readFileSync(API_KEY_PATH, 'utf8').trim();
    console.log('Gemini API key loaded successfully.');
  } else {
    console.warn(`WARNING: API Key file not found at ${API_KEY_PATH}. OCR scanning will not work.`);
  }
} catch (error) {
  console.error('Error reading API key:', error.message);
}

// Helpers for Reading/Writing Database
function readDatabase(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf8');
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
    return [];
  }
}

function writeDatabase(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing ${filePath}:`, error);
  }
}

// Get Local Network IP addresses to show on console
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// REST API Endpoints

// 1. Get all words, sorted alphabetically
app.get('/api/words', (req, res) => {
  const dbPath = getDatabasePath('words', getLangKey(req));
  const words = readDatabase(dbPath);
  words.sort((a, b) => a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }));
  res.json(words);
});

// 2. Add word manually
app.post('/api/words', (req, res) => {
  const { word, pronunciation, meaning, technique } = req.body;
  if (!word || !meaning) {
    return res.status(400).json({ error: 'Word and Meaning are required fields.' });
  }

  const dbPath = getDatabasePath('words', getLangKey(req));
  const words = readDatabase(dbPath);
  
  // Clean fields
  const newWord = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
    word: word.trim(),
    pronunciation: (pronunciation || '').trim(),
    meaning: meaning.trim(),
    technique: (technique || '').trim(),
    createdAt: new Date().toISOString()
  };

  // Avoid duplicate English words (case-insensitive check)
  const existingIndex = words.findIndex(w => w.word.toLowerCase() === newWord.word.toLowerCase());
  if (existingIndex > -1) {
    // Update existing
    words[existingIndex] = { ...words[existingIndex], ...newWord, id: words[existingIndex].id };
    writeDatabase(dbPath, words);
    res.json({ message: 'Kelime güncellendi.', word: words[existingIndex] });
  } else {
    words.push(newWord);
    writeDatabase(dbPath, words);
    res.status(201).json({ message: 'Kelime başarıyla eklendi.', word: newWord });
  }
});

// 2b. Add words in bulk (for syncing existing offline words)
app.post('/api/words/bulk', (req, res) => {
  const { words } = req.body;
  if (!Array.isArray(words)) {
    return res.status(400).json({ error: 'Words list must be an array.' });
  }

  const dbPath = getDatabasePath('words', getLangKey(req));
  const currentDbWords = readDatabase(dbPath);
  
  const addedWords = [];

  for (const item of words) {
    if (!item.word || !item.meaning) continue;
    
    const newWord = {
      id: item.id || (Date.now().toString(36) + Math.random().toString(36).substring(2, 5)),
      word: item.word.trim(),
      pronunciation: (item.pronunciation || '').trim(),
      meaning: item.meaning.trim(),
      technique: (item.technique || '').trim(),
      createdAt: item.createdAt || new Date().toISOString()
    };

    // Avoid duplicate
    const existingIndex = currentDbWords.findIndex(w => w.word.toLowerCase() === newWord.word.toLowerCase());
    if (existingIndex > -1) {
      currentDbWords[existingIndex] = { ...currentDbWords[existingIndex], ...newWord, id: currentDbWords[existingIndex].id };
      addedWords.push(currentDbWords[existingIndex]);
    } else {
      currentDbWords.push(newWord);
      addedWords.push(newWord);
    }
  }

  writeDatabase(dbPath, currentDbWords);
  res.json({ message: `${addedWords.length} kelime başarıyla eklendi.`, words: currentDbWords });
});

// 2c. Reset word list (used by Restore from Backup)
app.post('/api/words/reset', (req, res) => {
  const { words } = req.body;
  if (!Array.isArray(words)) {
    return res.status(400).json({ error: 'Words must be an array.' });
  }
  const dbPath = getDatabasePath('words', getLangKey(req));
  writeDatabase(dbPath, words);
  res.json({ message: 'Kelime veritabanı sıfırlandı ve yedek yüklendi.' });
});

// 3. Edit an existing word
app.put('/api/words/:id', (req, res) => {
  const { id } = req.params;
  const { word, pronunciation, meaning, technique } = req.body;
  if (!word || !meaning) {
    return res.status(400).json({ error: 'Word and Meaning are required.' });
  }

  const dbPath = getDatabasePath('words', getLangKey(req));
  const words = readDatabase(dbPath);
  const index = words.findIndex(w => w.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Kelime bulunamadı.' });
  }

  words[index] = {
    ...words[index],
    word: word.trim(),
    pronunciation: (pronunciation || '').trim(),
    meaning: meaning.trim(),
    technique: (technique || '').trim(),
    updatedAt: new Date().toISOString()
  };

  writeDatabase(dbPath, words);
  res.json({ message: 'Kelime düzenlendi.', word: words[index] });
});

// 4. Delete a word
app.delete('/api/words/:id', (req, res) => {
  const { id } = req.params;
  const dbPath = getDatabasePath('words', getLangKey(req));
  const words = readDatabase(dbPath);
  const filtered = words.filter(w => w.id !== id);
  
  if (words.length === filtered.length) {
    return res.status(404).json({ error: 'Kelime bulunamadı.' });
  }

  writeDatabase(dbPath, filtered);
  res.json({ message: 'Kelime başarıyla silindi.' });
});

// 5. OCR Process Image endpoint using Gemini API
app.post('/api/upload', async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Image data is required.' });
  }

  if (!geminiApiKey) {
    return res.status(500).json({ error: 'Gemini API anahtarı bulunamadı. Lütfen API key dosyasını kontrol edin.' });
  }

  // Parse mime type and extract base64 data
  const match = image.match(/^data:([^;]+);base64,(.+)$/);
  let mimeType = 'image/jpeg';
  let base64Data = image;

  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  // Define prompt for structured word extraction
  const systemInstruction = 
    `Extract all vocabulary items from this English learning textbook image. Each vocabulary entry contains:
1. English Word (Kelime) -> key 'word' (example: 'Abandon')
2. Turkish Pronunciation (Okunuşu) -> key 'pronunciation' (example: 'ıbandın')
3. Turkish Meaning (Türkçe Anlamı) -> key 'meaning' (example: 'Terk etmek')
4. Memory Technique (Hafıza Tekniği) -> key 'technique' (example: 'Topa çok abandığın halde kaleci kalesini terk etmedi.')

For each vocabulary item, parse these 4 parts exactly.
Return the output ONLY as a valid JSON array of objects.
Do NOT wrap the JSON output in markdown formatting blocks like \`\`\`json. Return pure JSON.
Example JSON response:
[
  {
    "word": "Abandon",
    "pronunciation": "ıbandın",
    "meaning": "Terk etmek",
    "technique": "Topa çok abandığın halde kaleci kalesini terk etmedi."
  }
]`;

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

  // Try gemini-3.5-flash, fallback to gemini-3.1-flash-lite
  let models = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];
  let geminiResponseText = '';
  let errors = [];

  for (const model of models) {
    try {
      console.log(`Sending image to Gemini API using model: ${model}...`);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const responseJson = await response.json();
      if (!response.ok) {
        throw new Error(responseJson.error?.message || `HTTP error! status: ${response.status}`);
      }

      const text = responseJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        geminiResponseText = text;
        break; // Successfully got response
      }
    } catch (err) {
      console.warn(`Model ${model} failed. Trying next one... Error:`, err.message);
      errors.push(`${model}: ${err.message}`);
    }
  }

  if (!geminiResponseText) {
    return res.status(500).json({ error: `Gemini API hatası: Tüm modeller başarısız oldu. [${errors.join(' | ')}]` });
  }

  try {
    // Parse Gemini output
    const extractedWords = JSON.parse(geminiResponseText.trim());
    if (!Array.isArray(extractedWords)) {
      throw new Error('Response is not a JSON array');
    }

    const dbPath = getDatabasePath('words', getLangKey(req));
    const words = readDatabase(dbPath);
    const addedWords = [];

    for (const item of extractedWords) {
      if (!item.word || !item.meaning) continue;
      
      const newWord = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5) + Math.floor(Math.random() * 100),
        word: item.word.trim(),
        pronunciation: (item.pronunciation || '').trim(),
        meaning: item.meaning.trim(),
        technique: (item.technique || '').trim(),
        createdAt: new Date().toISOString()
      };

      // Check if word exists
      const existingIndex = words.findIndex(w => w.word.toLowerCase() === newWord.word.toLowerCase());
      if (existingIndex > -1) {
        words[existingIndex] = { ...words[existingIndex], ...newWord, id: words[existingIndex].id };
        addedWords.push(words[existingIndex]);
      } else {
        words.push(newWord);
        addedWords.push(newWord);
      }
    }

    writeDatabase(dbPath, words);
    res.json({ message: `${addedWords.length} kelime başarıyla eklendi / güncellendi.`, words: addedWords });

  } catch (parseError) {
    console.error('Failed to parse Gemini output:', geminiResponseText);
    res.status(500).json({ error: 'Gemini yanıtı işlenemedi. Yanıt geçerli bir kelime listesi formatında değil.', details: parseError.message });
  }
});

// 6. Get Study History
app.get('/api/history', (req, res) => {
  const dbPath = getDatabasePath('history', getLangKey(req));
  const history = readDatabase(dbPath);
  // Sort descending by date (newest first)
  history.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(history);
});

// 7. Log Study Session
app.post('/api/history', (req, res) => {
  const { testName, score, wordsStudied } = req.body;
  if (!testName) {
    return res.status(400).json({ error: 'Test name is required.' });
  }

  const dbPath = getDatabasePath('history', getLangKey(req));
  const history = readDatabase(dbPath);
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
    date: new Date().toISOString(),
    testName: testName,
    score: score || 'N/A',
    wordsStudied: wordsStudied || []
  };

  history.push(record);
  writeDatabase(dbPath, history);
  res.status(201).json({ message: 'Çalışma geçmişi kaydedildi.', record });
});

// 7b. Sync progress history in bulk (for syncing offline test logs)
app.post('/api/history/bulk', (req, res) => {
  const { history } = req.body;
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: 'History list must be an array.' });
  }

  const dbPath = getDatabasePath('history', getLangKey(req));
  const currentDbHistory = readDatabase(dbPath);
  
  for (const item of history) {
    if (!item.testName) continue;
    // Avoid duplicate
    const exists = currentDbHistory.some(h => h.id === item.id || h.date === item.date);
    if (!exists) {
      currentDbHistory.push({
        id: item.id || (Date.now().toString(36) + Math.random().toString(36).substring(2, 5)),
        date: item.date || new Date().toISOString(),
        testName: item.testName,
        score: item.score || 'N/A',
        wordsStudied: item.wordsStudied || []
      });
    }
  }

  // Sort descending by date
  currentDbHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

  writeDatabase(dbPath, currentDbHistory);
  res.json({ message: 'Geçmiş veritabanı senkronize edildi.', history: currentDbHistory });
});

// 7c. Reset progress history (used by Restore from Backup)
app.post('/api/history/reset', (req, res) => {
  const { history } = req.body;
  if (!Array.isArray(history)) {
    return res.status(400).json({ error: 'History must be an array.' });
  }
  const dbPath = getDatabasePath('history', getLangKey(req));
  writeDatabase(dbPath, history);
  res.json({ message: 'Geçmiş veritabanı sıfırlandı ve yedek yüklendi.' });
});

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log('==================================================');
  console.log(`Resimden İngilizceye sunucusu başlatıldı.`);
  console.log(`Bilgisayarınızda erişmek için: http://localhost:${PORT}`);
  
  const ips = getLocalIPs();
  if (ips.length > 0) {
    console.log(`\nTablet veya Telefonunuzdan erişmek için (Aynı Wi-Fi):`);
    ips.forEach(ip => {
      console.log(`👉 http://${ip}:${PORT}`);
    });
  } else {
    console.log(`\nLocal network IP adresi bulunamadı. Wi-Fi bağlantınızı kontrol edin.`);
  }
  console.log('==================================================');
});
