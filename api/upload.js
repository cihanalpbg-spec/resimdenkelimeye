module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metod izin verilmedi.' });
  }

  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: 'Resim verisi eksik.' });
  }

  // Retrieve Gemini API Key from Vercel Environment Variables
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({ 
      error: 'Vercel ortam değişkenlerinde (Environment Variables) GEMINI_API_KEY bulunamadı. Lütfen Vercel panelinden ekleyin.' 
    });
  }

  // Parse mime type and extract base64 data
  const match = image.match(/^data:([^;]+);base64,(.+)$/);
  let mimeType = 'image/jpeg';
  let base64Data = image;

  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

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

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
  let geminiResponseText = '';
  let apiError = null;

  for (const model of models) {
    try {
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
        break; // Got response successfully
      }
    } catch (err) {
      console.warn(`Model ${model} failed:`, err.message);
      apiError = err;
    }
  }

  if (!geminiResponseText) {
    return res.status(500).json({ error: `Gemini API Hatası: ${apiError ? apiError.message : 'Yanıt alınamadı.'}` });
  }

  try {
    const extractedWords = JSON.parse(geminiResponseText.trim());
    return res.status(200).json({ words: extractedWords });
  } catch (parseError) {
    return res.status(500).json({ 
      error: 'Gemini yanıtı ayrıştırılamadı.', 
      details: parseError.message,
      raw: geminiResponseText 
    });
  }
};
