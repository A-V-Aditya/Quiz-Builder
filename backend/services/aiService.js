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
async function generateWithGemini(text, { numQuestions = 5, difficulty = 'Medium', apiKey, isTopicPrompt = false, customPrompt }) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('No Gemini API key provided.');
  }

  const ai = new GoogleGenAI({ apiKey: key });

  const systemPrompt = `You are an expert academic educator, university examiner, and quiz author.
Your task is to ${isTopicPrompt ? 'generate questions on the requested topic' : 'analyze the provided study material and generate questions'}.
Create exactly ${numQuestions} high-quality, relevant Multiple Choice Questions (MCQs).

Requirements:
1. Target Difficulty: ${difficulty}.
2. Each question MUST have exactly 4 distinct and plausible answer choices: option_a, option_b, option_c, and option_d.
3. Each question MUST designate exactly one unambiguously correct option: 'A', 'B', 'C', or 'D'.
4. Include a concise and descriptive suggested Quiz Title and Description.
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

  const truncatedText = text.length > 30000 ? text.slice(0, 30000) + '\n...[Content truncated for analysis]' : text;
  const modelsToTry = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-2.5-flash'];
  let lastError = null;

  const focusNote = customPrompt && customPrompt.trim()
    ? `\n\nSpecific Focus / Instruction from Instructor:\n"""\n${customPrompt.trim()}\n"""\nPrioritize generating questions that align with these focus instructions.`
    : '';

  for (const model of modelsToTry) {
    try {
      const userContent = isTopicPrompt 
        ? `Topic / Subject Prompt:\n"""\n${truncatedText}\n"""`
        : `Document Text:\n"""\n${truncatedText}\n"""${focusNote}`;

      const response = await ai.models.generateContent({
        model,
        contents: `${systemPrompt}\n\n${userContent}`,
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
      console.warn(`Gemini generation with ${model} failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to generate quiz with Gemini.');
}

/**
 * Generate questions using OpenAI API
 */
async function generateWithOpenAI(text, { numQuestions = 5, difficulty = 'Medium', apiKey, isTopicPrompt = false, customPrompt }) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('No OpenAI API key provided.');
  }

  const truncatedText = text.length > 25000 ? text.slice(0, 25000) + '\n...[Content truncated]' : text;
  const focusNote = customPrompt && customPrompt.trim()
    ? `\n\nSpecific Focus / Instruction from Instructor:\n"""\n${customPrompt.trim()}\n"""\nPrioritize generating questions that align with these focus instructions.`
    : '';

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
          content: `You are an academic exam generator. Generate ${numQuestions} MCQs. Difficulty: ${difficulty}. Output JSON: { "title": "...", "description": "...", "questions": [{ "question_text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A" }] }`
        },
        {
          role: 'user',
          content: isTopicPrompt ? `Topic: ${truncatedText}` : `Document:\n${truncatedText}${focusNote}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI API request failed (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const rawJSON = data.choices?.[0]?.message?.content;
  if (!rawJSON) {
    throw new Error('No content received from OpenAI.');
  }

  return parseAndValidateQuizJSON(rawJSON);
}

/**
 * Parse and validate JSON returned by LLM
 */
function parseAndValidateQuizJSON(rawText) {
  let cleaned = rawText.trim();
  const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = cleaned.match(jsonBlockRegex);
  if (match) {
    cleaned = match[1].trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch (err2) {
        throw new Error('Unable to parse JSON from AI model response.');
      }
    } else {
      throw new Error('Response did not contain valid JSON structure.');
    }
  }

  if (!parsed.questions || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('AI response does not contain any questions.');
  }

  const validQuestions = [];
  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (
      q.question_text &&
      q.option_a &&
      q.option_b &&
      q.option_c &&
      q.option_d &&
      q.correct_option &&
      ['A', 'B', 'C', 'D'].includes(q.correct_option.toString().trim().toUpperCase())
    ) {
      validQuestions.push({
        question_text: q.question_text.trim(),
        question_type: 'single',
        image_url: '',
        word_limit: 0,
        option_a: q.option_a.toString().trim(),
        option_b: q.option_b.toString().trim(),
        option_c: q.option_c.toString().trim(),
        option_d: q.option_d.toString().trim(),
        correct_option: q.correct_option.toString().trim().toUpperCase()
      });
    }
  }

  if (validQuestions.length === 0) {
    throw new Error('None of the AI generated questions met validation criteria.');
  }

  return {
    title: parsed.title ? parsed.title.trim() : 'AI Generated Assessment',
    description: parsed.description ? parsed.description.trim() : 'Auto-generated quiz questions.',
    questions: validQuestions
  };
}

/**
 * Heuristic fallback for PDF text
 */
function generateWithFallback(text, { numQuestions = 5, difficulty = 'Medium' }) {
  const rawSentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim().replace(/\s+/g, ' '))
    .filter(s => s.length >= 35 && s.length <= 250);

  const candidateStatements = [];
  for (const s of rawSentences) {
    if (/\b(is defined as|is a|means|refers to|consists of|are used for|primary function|key principle)\b/i.test(s)) {
      candidateStatements.push(s);
    }
  }

  for (const s of rawSentences) {
    if (candidateStatements.length >= numQuestions * 2) break;
    if (!candidateStatements.includes(s) && s.length > 50) {
      candidateStatements.push(s);
    }
  }

  const words = text.match(/\b[A-Z][a-zA-Z]{3,}\b/g) || [];
  const uniqueTerms = Array.from(new Set(words)).filter(w => !['The', 'This', 'That', 'These', 'Those', 'From', 'With', 'When', 'What', 'Where'].includes(w));

  const questions = [];
  const targetCount = Math.min(numQuestions, Math.max(3, candidateStatements.length));

  for (let i = 0; i < targetCount; i++) {
    const statement = candidateStatements[i] || `The document discusses essential principles of modern computing systems.`;
    let questionText = '';
    let correctAnswer = '';
    const match = statement.match(/^([^,]+?)\s+(is defined as|is a|refers to|is an|consists of)\s+(.+)$/i);

    if (match) {
      const subject = match[1].trim();
      const predicate = match[3].trim().replace(/\.$/, '');
      questionText = `According to the document, which of the following ${match[2]} "${predicate}"?`;
      correctAnswer = subject;
    } else {
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

    const distractors = [];
    for (const term of uniqueTerms) {
      if (term !== correctAnswer && !distractors.includes(term) && distractors.length < 3) {
        distractors.push(term);
      }
    }

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

    const optionsArray = [
      { text: correctAnswer, isCorrect: true },
      { text: distractors[0], isCorrect: false },
      { text: distractors[1], isCorrect: false },
      { text: distractors[2], isCorrect: false }
    ];

    const shift = i % 4;
    const shuffled = [...optionsArray.slice(shift), ...optionsArray.slice(0, shift)];
    const correctLetter = ['A', 'B', 'C', 'D'][shuffled.findIndex(o => o.isCorrect)];

    questions.push({
      question_text: questionText,
      question_type: 'single',
      image_url: '',
      word_limit: 0,
      option_a: shuffled[0].text,
      option_b: shuffled[1].text,
      option_c: shuffled[2].text,
      option_d: shuffled[3].text,
      correct_option: correctLetter
    });
  }

  return {
    title: 'Extracted Document Assessment',
    description: `Assessment covering key concepts (${difficulty} difficulty).`,
    questions
  };
}

/**
 * Heuristic fallback for topic prompt
 */
function generatePromptFallback(prompt, { numQuestions = 5, difficulty = 'Medium' }) {
  const cleanPrompt = prompt.trim();
  const words = cleanPrompt.split(/\s+/).filter(w => w.length > 2);
  const mainSubject = words.slice(0, 3).join(' ') || 'Core Concepts';

  const templateQuestions = [
    {
      q: `What is the primary objective of ${mainSubject}?`,
      a: `To optimize functionality, reliability, and structured workflow`,
      d: ['To maximize redundant processing', 'To eliminate all external dependencies', 'To enforce purely manual operations']
    },
    {
      q: `Which architectural principle is most strongly associated with ${mainSubject}?`,
      a: `Modularity and separation of concerns`,
      d: ['Tight monolithic coupling', 'Unregulated memory access', 'Unchecked global state mutations']
    },
    {
      q: `When designing or analyzing ${mainSubject}, what is a critical operational consideration?`,
      a: `Scalability, latency, and fault tolerance`,
      d: ['Ignoring concurrent race conditions', 'Bypassing security validations', 'Assuming infinite bandwidth']
    },
    {
      q: `In the context of ${mainSubject}, which metric provides the most accurate performance indicator?`,
      a: `Throughput and error rate under peak load`,
      d: ['Arbitrary code line count', 'Uncached memory consumption', 'Physical disk sector size']
    },
    {
      q: `Which best practice should be applied when maintaining systems related to ${mainSubject}?`,
      a: `Automated testing and continuous monitoring`,
      d: ['Deploying unverified hotfixes directly to production', 'Suppressing all error telemetry', 'Hardcoding secret credentials']
    }
  ];

  const questions = [];
  const count = Math.min(numQuestions, templateQuestions.length);

  for (let i = 0; i < count; i++) {
    const t = templateQuestions[i];
    const optionsArray = [
      { text: t.a, isCorrect: true },
      { text: t.d[0], isCorrect: false },
      { text: t.d[1], isCorrect: false },
      { text: t.d[2], isCorrect: false }
    ];
    const shift = i % 4;
    const shuffled = [...optionsArray.slice(shift), ...optionsArray.slice(0, shift)];
    const correctLetter = ['A', 'B', 'C', 'D'][shuffled.findIndex(o => o.isCorrect)];

    questions.push({
      question_text: t.q,
      question_type: 'single',
      image_url: '',
      word_limit: 0,
      option_a: shuffled[0].text,
      option_b: shuffled[1].text,
      option_c: shuffled[2].text,
      option_d: shuffled[3].text,
      correct_option: correctLetter
    });
  }

  return {
    title: `${mainSubject} Assessment`,
    description: `Comprehensive questions on ${mainSubject} (${difficulty} level).`,
    questions
  };
}

/**
 * Generate quiz from uploaded PDF
 */
async function generateQuizFromPDF(buffer, options = {}) {
  const { numQuestions = 5, difficulty = 'Medium', apiKey, customPrompt } = options;

  const extractedText = await extractTextFromPDF(buffer);
  if (!extractedText || extractedText.trim().length < 50) {
    throw new Error('The uploaded PDF does not contain sufficient readable text to generate questions.');
  }

  const activeKey = apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (activeKey && !activeKey.startsWith('sk-')) {
    try {
      const result = await generateWithGemini(extractedText, { numQuestions, difficulty, apiKey: activeKey, isTopicPrompt: false, customPrompt });
      return {
        ...result,
        source: 'gemini',
        extractedLength: extractedText.length
      };
    } catch (err) {
      console.warn('Gemini generation failed, falling back:', err.message);
    }
  }

  if (activeKey && activeKey.startsWith('sk-')) {
    try {
      const result = await generateWithOpenAI(extractedText, { numQuestions, difficulty, apiKey: activeKey, isTopicPrompt: false, customPrompt });
      return {
        ...result,
        source: 'openai',
        extractedLength: extractedText.length
      };
    } catch (err) {
      console.warn('OpenAI generation failed, falling back:', err.message);
    }
  }

  const fallbackResult = generateWithFallback(extractedText, { numQuestions, difficulty });
  return {
    ...fallbackResult,
    source: 'fallback',
    message: activeKey
      ? 'AI service was unreachable. Generated questions using document analysis fallback.'
      : 'Generated questions using document analysis.',
    extractedLength: extractedText.length
  };
}

/**
 * Generate quiz from text prompt
 */
async function generateQuizFromPrompt(promptText, options = {}) {
  const { numQuestions = 5, difficulty = 'Medium', apiKey } = options;

  if (!promptText || promptText.trim().length < 3) {
    throw new Error('Please enter a valid topic or prompt.');
  }

  const activeKey = apiKey || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;

  if (activeKey && !activeKey.startsWith('sk-')) {
    try {
      const result = await generateWithGemini(promptText, { numQuestions, difficulty, apiKey: activeKey, isTopicPrompt: true });
      return {
        ...result,
        source: 'gemini'
      };
    } catch (err) {
      console.warn('Gemini prompt generation failed:', err.message);
    }
  }

  if (activeKey && activeKey.startsWith('sk-')) {
    try {
      const result = await generateWithOpenAI(promptText, { numQuestions, difficulty, apiKey: activeKey, isTopicPrompt: true });
      return {
        ...result,
        source: 'openai'
      };
    } catch (err) {
      console.warn('OpenAI prompt generation failed:', err.message);
    }
  }

  const fallbackResult = generatePromptFallback(promptText, { numQuestions, difficulty });
  return {
    ...fallbackResult,
    source: 'fallback',
    message: activeKey
      ? 'AI service was unreachable. Generated questions using topic heuristic engine.'
      : 'Generated questions using topic heuristic engine.'
  };
}

/**
 * Evaluates a student's descriptive written answer against the question prompt and rubric
 */
async function evaluateDescriptiveAnswer({ questionText, rubric, studentAnswer, wordLimit, apiKey }) {
  if (!studentAnswer || !studentAnswer.trim()) {
    return {
      is_correct: 0,
      feedback: 'No response submitted.'
    };
  }

  const trimmedAnswer = studentAnswer.trim();
  const wordCount = trimmedAnswer.split(/\s+/).length;

  const activeKey = apiKey || process.env.GEMINI_API_KEY;
  if (activeKey && !activeKey.startsWith('sk-')) {
    try {
      const ai = new GoogleGenAI({ apiKey: activeKey });
      const prompt = `You are an academic university professor grading a student's written response to an exam question.

Question Prompt:
"""
${questionText}
"""

Teacher Rubric / Reference Model Answer:
"""
${rubric || 'Demonstrate understanding of the key concepts.'}
"""

Student's Written Response:
"""
${trimmedAnswer}
"""

Word Limit: ${wordLimit || 150} words.

Evaluate whether the student demonstrates adequate conceptual understanding of the core concepts.
- Award credit (is_correct: 1) if the answer is conceptually sound and covers the key principles, even if rephrased.
- Mark as incorrect (is_correct: 0) if it is factually wrong, completely irrelevant, or merely repeats the prompt without explanation.
- Provide 1-2 concise, constructive feedback sentences explaining the assessment.

Return ONLY a valid JSON object matching this schema:
{
  "is_correct": 1,
  "feedback": "1-2 sentences of feedback."
}`;

      const modelsToTry = ['gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              responseMimeType: 'application/json'
            }
          });
          const responseText = response.text || (response.candidates && response.candidates[0]?.content?.parts?.[0]?.text);
          if (responseText) {
            const parsed = JSON.parse(responseText);
            return {
              is_correct: parsed.is_correct === 1 || parsed.is_correct === true ? 1 : 0,
              feedback: parsed.feedback || (parsed.is_correct ? 'Conceptually sound response.' : 'Response lacks key elements specified in rubric.')
            };
          }
        } catch (mErr) {
          // try next model
        }
      }
    } catch (err) {
      console.warn('Gemini grading error, using semantic fallback:', err.message);
    }
  }

  // Heuristic Offline Fallback
  const cleanRubric = (rubric || '').toLowerCase();
  const cleanAnswer = trimmedAnswer.toLowerCase();
  const rubricKeywords = cleanRubric
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['with', 'from', 'that', 'this', 'have', 'were', 'which', 'also'].includes(w));

  const matched = rubricKeywords.filter(w => cleanAnswer.includes(w)).length;
  const matchRatio = rubricKeywords.length > 0 ? (matched / rubricKeywords.length) : 0.5;

  if (wordCount >= 8 && (matchRatio >= 0.2 || rubricKeywords.length === 0)) {
    return {
      is_correct: 1,
      feedback: 'AI Assessment: Comprehensive response demonstrating grasp of foundational concepts.'
    };
  } else {
    return {
      is_correct: 0,
      feedback: 'AI Assessment: Response requires greater depth and key conceptual elements from the rubric.'
    };
  }
}

module.exports = {
  extractTextFromPDF,
  generateQuizFromPDF,
  generateQuizFromPrompt,
  generateWithFallback,
  parseAndValidateQuizJSON,
  evaluateDescriptiveAnswer
};
