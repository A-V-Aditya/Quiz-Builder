const { PDFParse } = require('pdf-parse');
const { GoogleGenAI } = require('@google/genai');

/**
 * Extract plain text from an uploaded PDF buffer
 */
async function extractTextFromPDF(buffer) {
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    if (typeof parser.destroy === 'function') {
      try {
        await parser.destroy();
      } catch (err) {
        // ignore cleanup error
      }
    }

    let rawText = '';
    if (typeof result === 'string') {
      rawText = result;
    } else if (result && typeof result.text === 'string') {
      rawText = result.text;
    } else if (result && Array.isArray(result.pages)) {
      rawText = result.pages.map(p => p.text || '').join('\n');
    }

    // Clean up excessive whitespace and page marker lines
    const cleaned = rawText
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return cleaned;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to parse and extract text from the provided PDF file.');
  }
}

/**
 * Generate questions using Google Gemini API
 */
async function generateWithGemini(text, { numQuestions = 5, difficulty = 'Medium', apiKey }) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('No Gemini API key provided.');
  }

  const ai = new GoogleGenAI({ apiKey: key });

  const systemPrompt = `You are an expert academic educator, university examiner, and quiz author.
Your task is to analyze the provided study material / document text and generate exactly ${numQuestions} high-quality, relevant Multiple Choice Questions (MCQs).

Requirements:
1. Target Difficulty: ${difficulty}.
2. Each question MUST have exactly 4 distinct and plausible answer choices: option_a, option_b, option_c, and option_d.
3. Each question MUST designate exactly one unambiguously correct option: 'A', 'B', 'C', or 'D'.
4. Include a concise and descriptive suggested Quiz Title and Description based on the document's subject matter.
5. You MUST return ONLY a valid, parseable JSON object matching this schema:
{
  "title": "Suggested Quiz Title",
  "description": "Short 1-2 sentence overview of quiz content",
  "questions": [
    {
      "question_text": "Clear and specific question prompt?",
      "option_a": "First option",
      "option_b": "Second option",
      "option_c": "Third option",
      "option_d": "Fourth option",
      "correct_option": "A"
    }
  ]
}`;

  // Truncate document if exceedingly large to stay comfortably within context limits
  const truncatedText = text.length > 30000 ? text.slice(0, 30000) + '\n...[Content truncated for analysis]' : text;

  // Try with gemini-2.5-flash first, fallback to gemini-2.0-flash / gemini-1.5-flash
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: `${systemPrompt}\n\nDocument Text:\n"""\n${truncatedText}\n"""`,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text);
      if (!responseText) {
        throw new Error('Empty response received from Gemini.');
      }

      const parsed = parseAndValidateQuizJSON(responseText);
      return parsed;
    } catch (err) {
      console.warn(`Gemini generation with ${model} failed, trying next model:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to generate quiz with Gemini.');
}

/**
 * Generate questions using OpenAI API (if OpenAI key is provided)
 */
async function generateWithOpenAI(text, { numQuestions = 5, difficulty = 'Medium', apiKey }) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('No OpenAI API key provided.');
  }

  const truncatedText = text.length > 25000 ? text.slice(0, 25000) + '\n...[Content truncated]' : text;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an academic exam generator. Generate ${numQuestions} MCQs based on the text. Difficulty: ${difficulty}. Output JSON: { "title": "...", "description": "...", "questions": [{ "question_text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A" }] }`
        },
        {
          role: 'user',
          content: `Document:\n${truncatedText}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `OpenAI request failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content;
  return parseAndValidateQuizJSON(rawContent);
}

/**
 * Heuristic/NLP Fallback Generator when no AI key is configured or offline
 * Extracts key sentences, terms, definitions, and creates structured MCQs from the document.
 */
function generateWithFallback(text, { numQuestions = 5, difficulty = 'Medium' }) {
  // Extract sentences
  const rawSentences = text
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 35 && s.length <= 250 && !s.startsWith('http') && !s.includes('@'));

  // Look for definition / key concept patterns
  const candidateStatements = [];
  const definitionRegex = /\b(is defined as|is a|are defined as|refers to|consists of|responsible for|used for|used to|plays a vital role in|known as|characterized by)\b/i;

  for (const s of rawSentences) {
    if (definitionRegex.test(s)) {
      candidateStatements.push(s);
    }
  }

  // Fill in with regular informative sentences if needed
  for (const s of rawSentences) {
    if (candidateStatements.length >= numQuestions * 2) break;
    if (!candidateStatements.includes(s) && s.length > 50) {
      candidateStatements.push(s);
    }
  }

  // Extract key terms / noun phrases for distractors
  const words = text.match(/\b[A-Z][a-zA-Z]{3,}\b/g) || [];
  const uniqueTerms = Array.from(new Set(words)).filter(w => !['The', 'This', 'That', 'These', 'Those', 'From', 'With', 'When', 'What', 'Where'].includes(w));

  const questions = [];
  const targetCount = Math.min(numQuestions, Math.max(3, candidateStatements.length));

  for (let i = 0; i < targetCount; i++) {
    const statement = candidateStatements[i] || `The study material discusses core principles and implementations of modern systems.`;

    // Create fill-in-the-blank or identification question
    let questionText = '';
    let correctAnswer = '';
    const match = statement.match(/^([^,]+?)\s+(is defined as|is a|refers to|is an|consists of)\s+(.+)$/i);

    if (match) {
      const subject = match[1].trim();
      const predicate = match[3].trim().replace(/\.$/, '');
      questionText = `According to the document, which of the following ${match[2]} "${predicate}"?`;
      correctAnswer = subject;
    } else {
      // Pick a prominent word/phrase to mask
      const parts = statement.split(' ');
      if (parts.length > 6) {
        const midIdx = Math.floor(parts.length / 2);
        correctAnswer = parts.slice(midIdx, midIdx + 2).join(' ').replace(/[.,;:()]/g, '');
        const masked = [...parts];
        masked.splice(midIdx, 2, '________');
        questionText = `Complete the statement from the document: "${masked.join(' ')}"`;
      } else {
        questionText = `Which statement is supported by the document: "${statement}"?`;
        correctAnswer = 'Accurately stated in text';
      }
    }

    // Build distractors
    const distractors = [];
    for (const term of uniqueTerms) {
      if (term !== correctAnswer && !distractors.includes(term) && distractors.length < 3) {
        distractors.push(term);
      }
    }

    // Default fallbacks if not enough unique terms found
    const defaultDistractors = [
      'None of the above',
      'Alternative conceptual model',
      'Secondary auxiliary subsystem',
      'Deprecated legacy protocol'
    ];
    let dIdx = 0;
    while (distractors.length < 3) {
      distractors.push(defaultDistractors[dIdx % defaultDistractors.length]);
      dIdx++;
    }

    // Shuffle options and pick correct letter
    const optionsArray = [
      { text: correctAnswer, isCorrect: true },
      { text: distractors[0], isCorrect: false },
      { text: distractors[1], isCorrect: false },
      { text: distractors[2], isCorrect: false }
    ];

    // Simple deterministic pseudo-shuffle based on question index
    const shift = i % 4;
    const shuffled = [...optionsArray.slice(shift), ...optionsArray.slice(0, shift)];
    const correctLetter = ['A', 'B', 'C', 'D'][shuffled.findIndex(o => o.isCorrect)];

    questions.push({
      question_text: questionText,
      option_a: shuffled[0].text,
      option_b: shuffled[1].text,
      option_c: shuffled[2].text,
      option_d: shuffled[3].text,
      correct_option: correctLetter
    });
  }

  // Derive title from top terms or first heading
  const firstLine = text.split('\n').map(l => l.trim()).find(l => l.length > 5 && l.length < 80) || 'Document Study Material';
  const title = `${firstLine.slice(0, 50)} Quiz`;

  return {
    title,
    description: `Auto-generated ${difficulty} quiz based on the uploaded document (${questions.length} questions).`,
    questions
  };
}

/**
 * Validates and normalizes JSON quiz structure
 */
function parseAndValidateQuizJSON(rawString) {
  let cleaned = rawString.trim();
  // Remove markdown code fence if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch (err) {
    // Attempt regex extraction if JSON is wrapped in other text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      data = JSON.parse(match[0]);
    } else {
      throw new Error('Failed to parse AI response into valid JSON: ' + err.message);
    }
  }

  if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
    throw new Error('AI response did not contain a valid questions list.');
  }

  const validQuestions = data.questions.map((q, idx) => {
    let correct = (q.correct_option || 'A').toString().trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correct)) {
      correct = 'A';
    }

    return {
      question_text: q.question_text || `Question #${idx + 1}`,
      option_a: q.option_a || 'Option A',
      option_b: q.option_b || 'Option B',
      option_c: q.option_c || 'Option C',
      option_d: q.option_d || 'Option D',
      correct_option: correct
    };
  });

  return {
    title: (data.title || 'AI Generated Quiz').trim(),
    description: (data.description || 'Generated from uploaded document.').trim(),
    questions: validQuestions
  };
}

/**
 * Master entry point: parses PDF buffer and generates structured quiz
 */
async function generateQuizFromPDF(buffer, options = {}) {
  const { numQuestions = 5, difficulty = 'Medium', apiKey } = options;

  // 1. Extract text
  const extractedText = await extractTextFromPDF(buffer);
  if (!extractedText || extractedText.trim().length < 50) {
    throw new Error('The uploaded PDF does not contain sufficient readable text to generate questions.');
  }

  const activeKey = apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  // 2. Try Gemini first if key exists or default key is present
  if (activeKey && !activeKey.startsWith('sk-')) {
    try {
      const result = await generateWithGemini(extractedText, { numQuestions, difficulty, apiKey: activeKey });
      return {
        ...result,
        source: 'gemini',
        extractedLength: extractedText.length
      };
    } catch (err) {
      console.warn('Gemini generation failed, falling back to local NLP generator:', err.message);
    }
  }

  // 3. Try OpenAI if key starts with sk-
  if (activeKey && activeKey.startsWith('sk-')) {
    try {
      const result = await generateWithOpenAI(extractedText, { numQuestions, difficulty, apiKey: activeKey });
      return {
        ...result,
        source: 'openai',
        extractedLength: extractedText.length
      };
    } catch (err) {
      console.warn('OpenAI generation failed, falling back to local NLP generator:', err.message);
    }
  }

  // 4. Reliable heuristic/NLP fallback
  const fallbackResult = generateWithFallback(extractedText, { numQuestions, difficulty });
  return {
    ...fallbackResult,
    source: 'fallback',
    message: activeKey
      ? 'AI service was unreachable or quota exceeded. Generated questions using document analysis fallback.'
      : 'Generated questions using built-in document analysis. Add GEMINI_API_KEY to backend/.env for generative AI questions.',
    extractedLength: extractedText.length
  };
}

module.exports = {
  extractTextFromPDF,
  generateQuizFromPDF,
  generateWithFallback,
  parseAndValidateQuizJSON
};
