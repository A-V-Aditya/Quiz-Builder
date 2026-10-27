const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const { verifyToken, requireTeacher, requireStudent } = require('../middleware/auth');
const { generateQuizFromPDF, generateQuizFromPrompt } = require('../services/aiService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20 MB limit
});

// AI Endpoint: Generate Quiz from uploaded PDF (Teacher only)
router.post('/generate-from-pdf', verifyToken, requireTeacher, (req, res) => {
  upload.single('pdf')(req, res, async (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File is too large. Maximum PDF size is 20MB.' });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ message: `Failed to upload PDF: ${err.message}` });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No PDF file was uploaded.' });
      }

      if (req.file.mimetype !== 'application/pdf' && !req.file.originalname.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ message: 'Invalid file type. Only PDF (.pdf) files are supported.' });
      }

      const numQuestions = parseInt(req.body.numQuestions, 10) || 5;
      const difficulty = req.body.difficulty || 'Medium';
      const apiKey = req.body.apiKey ? req.body.apiKey.trim() : undefined;
      const customPrompt = req.body.prompt ? req.body.prompt.trim() : undefined;

      const result = await generateQuizFromPDF(req.file.buffer, {
        numQuestions: Math.max(1, Math.min(50, numQuestions)),
        difficulty,
        apiKey,
        customPrompt
      });

      return res.json({
        success: true,
        filename: req.file.originalname,
        title: result.title,
        description: result.description,
        questions: result.questions,
        source: result.source,
        message: result.message
      });
    } catch (error) {
      console.error('Error in /generate-from-pdf route:', error);
      return res.status(500).json({
        message: error.message || 'An error occurred while scanning the PDF and generating questions.'
      });
    }
  });
});

// AI Endpoint: Generate Quiz from direct prompt/topic (Teacher only, No PDF needed!)
router.post('/generate-from-prompt', verifyToken, requireTeacher, async (req, res) => {
  try {
    const { prompt, numQuestions = 5, difficulty = 'Medium', apiKey } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: 'Prompt or topic description is required.' });
    }

    const result = await generateQuizFromPrompt(prompt.trim(), {
      numQuestions: Math.max(1, Math.min(25, parseInt(numQuestions, 10) || 5)),
      difficulty,
      apiKey: apiKey ? apiKey.trim() : undefined
    });

    return res.json({
      success: true,
      title: result.title,
      description: result.description,
      questions: result.questions,
      source: result.source,
      message: result.message
    });
  } catch (error) {
    console.error('Error in /generate-from-prompt route:', error);
    return res.status(500).json({
      message: error.message || 'An error occurred while generating questions from prompt.'
    });
  }
});

// 1. Create a Quiz (Teacher only)
router.post('/', verifyToken, requireTeacher, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      title,
      description,
      questions,
      disable_copy = 1,
      end_date = null,
      results_policy = 'on_quiz_end'
    } = req.body;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Title and at least one question are required.' });
    }

    const validPolicies = ['on_quiz_end', 'immediate_score_only', 'immediate_full'];
    const activePolicy = validPolicies.includes(results_policy) ? results_policy : 'on_quiz_end';

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text || !q.question_text.trim()) {
        return res.status(400).json({ message: `Question #${i + 1} prompt statement is required.` });
      }

      const qType = q.question_type || 'single';

      if (qType === 'single') {
        if (!q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option) {
          return res.status(400).json({ message: `Question #${i + 1} requires 4 options and a correct answer choice.` });
        }
      } else if (qType === 'multiple') {
        if (!q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option) {
          return res.status(400).json({ message: `Question #${i + 1} (Multiple Choice) requires 4 options and at least one correct choice.` });
        }
      }
    }

    await connection.beginTransaction();

    // Insert Quiz
    const [quizResult] = await connection.query(
      `INSERT INTO quizzes (
        teacher_id, title, description, status, disable_copy, end_date, results_policy
      ) VALUES (?, ?, ?, 'open', ?, ?, ?)`,
      [
        req.user.id,
        title.trim(),
        description ? description.trim() : '',
        disable_copy ? 1 : 0,
        end_date && end_date.trim() ? end_date.trim() : null,
        activePolicy
      ]
    );
    const quizId = quizResult.insertId;

    // Insert Questions
    for (const q of questions) {
      const qType = q.question_type || 'single';
      const imageUrl = q.image_url ? q.image_url.trim() : null;
      const wordLimit = parseInt(q.word_limit, 10) || 0;

      let correctOpt = q.correct_option || '';
      if (Array.isArray(correctOpt)) {
        correctOpt = correctOpt.sort().join(',');
      } else if (typeof correctOpt === 'string') {
        correctOpt = correctOpt.trim().toUpperCase();
      }

      const gradingMode = qType === 'descriptive' ? (q.grading_mode === 'ai' ? 'ai' : 'manual') : null;

      await connection.query(
        `INSERT INTO questions (
          quiz_id, question_text, question_type, grading_mode, image_url, word_limit,
          option_a, option_b, option_c, option_d, correct_option
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quizId,
          q.question_text.trim(),
          qType,
          gradingMode,
          imageUrl,
          wordLimit,
          q.option_a || null,
          q.option_b || null,
          q.option_c || null,
          q.option_d || null,
          correctOpt
        ]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: 'Quiz published successfully!',
      quizId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error creating quiz:', error);
    res.status(500).json({ message: 'Internal server error while creating quiz.' });
  } finally {
    connection.release();
  }
});

// 2. Get Quizzes created by Teacher
router.get('/teacher', verifyToken, requireTeacher, async (req, res) => {
  try {
    const query = `
      SELECT 
        q.id,
        q.title,
        q.description,
        q.status,
        q.disable_copy,
        q.end_date,
        q.results_policy,
        q.created_at,
        COUNT(DISTINCT qu.id) AS total_questions,
        COUNT(DISTINCT a.id) AS total_attempts
      FROM quizzes q
      LEFT JOIN questions qu ON q.id = qu.quiz_id
      LEFT JOIN attempts a ON q.id = a.quiz_id
      WHERE q.teacher_id = ?
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `;
    const [quizzes] = await pool.query(query, [req.user.id]);

    // Compute effective active state (if deadline passed, treat as closed / expired)
    const formatted = quizzes.map(q => {
      const isExpired = q.end_date && new Date(q.end_date) < new Date();
      return {
        ...q,
        is_expired: Boolean(isExpired),
        effective_status: (q.status === 'closed' || isExpired) ? 'closed' : 'open'
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching teacher quizzes:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 3. Get Open Quizzes available for Student to attempt
router.get('/available', verifyToken, requireStudent, async (req, res) => {
  try {
    const query = `
      SELECT 
        q.id,
        q.title,
        q.description,
        q.status,
        q.disable_copy,
        q.end_date,
        q.results_policy,
        q.created_at,
        u.name AS teacher_name,
        COUNT(DISTINCT qu.id) AS total_questions
      FROM quizzes q
      JOIN users u ON q.teacher_id = u.id
      LEFT JOIN questions qu ON q.id = qu.quiz_id
      WHERE q.status = 'open'
        AND (q.end_date IS NULL OR q.end_date = '' OR datetime(q.end_date) > datetime('now'))
        AND q.id NOT IN (
          SELECT quiz_id FROM attempts WHERE student_id = ?
        )
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `;
    const [quizzes] = await pool.query(query, [req.user.id]);

    // Extra safety check in JS for ISO dates
    const now = new Date();
    const available = quizzes.filter(q => {
      if (!q.end_date) return true;
      return new Date(q.end_date) > now;
    });

    res.json(available);
  } catch (error) {
    console.error('Error fetching available quizzes:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 4. Get Quiz Details & Questions
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const quizId = req.params.id;

    const [quizzes] = await pool.query(
      `SELECT q.*, u.name AS teacher_name 
       FROM quizzes q 
       JOIN users u ON q.teacher_id = u.id 
       WHERE q.id = ?`,
      [quizId]
    );

    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    const quiz = quizzes[0];
    const isExpired = quiz.end_date && new Date(quiz.end_date) < new Date();
    const isClosed = quiz.status === 'closed' || isExpired;

    if (req.user.role === 'teacher' && quiz.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden. You did not create this quiz.' });
    }

    let questionsQuery;
    if (req.user.role === 'teacher') {
      questionsQuery = `
        SELECT id, question_text, question_type, grading_mode, image_url, word_limit,
               option_a, option_b, option_c, option_d, correct_option 
        FROM questions 
        WHERE quiz_id = ?
        ORDER BY id ASC
      `;
    } else {
      questionsQuery = `
        SELECT id, question_text, question_type, grading_mode, image_url, word_limit,
               option_a, option_b, option_c, option_d 
        FROM questions 
        WHERE quiz_id = ?
        ORDER BY id ASC
      `;
    }

    const [questions] = await pool.query(questionsQuery, [quizId]);

    res.json({
      quiz: {
        ...quiz,
        is_expired: isExpired,
        is_closed: isClosed
      },
      questions
    });
  } catch (error) {
    console.error('Error fetching quiz details:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 5. Quiz Analytics & Leaderboard (Teacher only)
router.get('/:id/analytics', verifyToken, requireTeacher, async (req, res) => {
  try {
    const quizId = req.params.id;

    const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE id = ?', [quizId]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    const quiz = quizzes[0];
    if (quiz.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden.' });
    }

    // 1. Fetch attempts with student info
    const [attempts] = await pool.query(
      `SELECT 
        a.id AS attempt_id,
        u.id AS student_id,
        u.name AS student_name,
        u.email AS student_email,
        a.score,
        a.total_questions,
        ROUND((a.score * 100.0 / CASE WHEN a.total_questions = 0 THEN 1 ELSE a.total_questions END), 1) AS percentage,
        a.submitted_at
      FROM attempts a
      JOIN users u ON a.student_id = u.id
      WHERE a.quiz_id = ?
      ORDER BY a.score DESC, a.submitted_at ASC`,
      [quizId]
    );

    const totalAttempts = attempts.length;
    const scores = attempts.map(a => a.score);
    const percentages = attempts.map(a => a.percentage);

    // Score stats
    const avgScore = totalAttempts > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / totalAttempts) * 10) / 10
      : 0;
    const highestScore = totalAttempts > 0 ? Math.max(...scores) : 0;
    const lowestScore = totalAttempts > 0 ? Math.min(...scores) : 0;
    const passCount = percentages.filter(p => p >= 50).length;
    const passRate = totalAttempts > 0 ? Math.round((passCount / totalAttempts) * 100) : 0;

    // Distribution (0-25%, 26-50%, 51-75%, 76-100%)
    const distribution = {
      '0-25%': percentages.filter(p => p <= 25).length,
      '26-50%': percentages.filter(p => p > 25 && p <= 50).length,
      '51-75%': percentages.filter(p => p > 50 && p <= 75).length,
      '76-100%': percentages.filter(p => p > 75).length
    };

    // Leaderboard (All ranked attempts with attempt_id included for sheet inspection)
    const leaderboard = attempts.map((att, i) => ({
      rank: i + 1,
      attempt_id: att.attempt_id,
      student_id: att.student_id,
      student_name: att.student_name,
      student_email: att.student_email,
      score: att.score,
      total_questions: att.total_questions,
      percentage: att.percentage,
      submitted_at: att.submitted_at
    }));

    // 2. Question-level accuracy breakdown
    const [questions] = await pool.query(
      `SELECT id, question_text, question_type, image_url, correct_option 
       FROM questions 
       WHERE quiz_id = ? 
       ORDER BY id ASC`,
      [quizId]
    );

    const [answers] = await pool.query(
      `SELECT aa.question_id, aa.is_correct 
       FROM attempt_answers aa
       JOIN attempts a ON aa.attempt_id = a.id
       WHERE a.quiz_id = ?`,
      [quizId]
    );

    const questionStats = questions.map((q, idx) => {
      const qAnswers = answers.filter(ans => ans.question_id === q.id);
      const totalAnswers = qAnswers.length;
      const correctAnswers = qAnswers.filter(ans => ans.is_correct === 1).length;
      const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

      let difficultyLabel = 'Moderate';
      if (accuracy >= 75) difficultyLabel = 'Easy';
      else if (accuracy < 40) difficultyLabel = 'Hard';

      return {
        question_id: q.id,
        index: idx + 1,
        question_text: q.question_text,
        question_type: q.question_type,
        total_answers: totalAnswers,
        correct_count: correctAnswers,
        incorrect_count: totalAnswers - correctAnswers,
        accuracy_percent: accuracy,
        difficulty: difficultyLabel
      };
    });

    res.json({
      quiz,
      stats: {
        total_attempts: totalAttempts,
        avg_score: avgScore,
        highest_score: highestScore,
        lowest_score: lowestScore,
        pass_rate: passRate,
        pass_count: passCount
      },
      distribution,
      leaderboard,
      question_stats: questionStats
    });
  } catch (error) {
    console.error('Error fetching quiz analytics:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 6. Close / Stop a Quiz manually (Teacher only)
router.patch('/:id/close', verifyToken, requireTeacher, async (req, res) => {
  try {
    const quizId = req.params.id;

    const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE id = ?', [quizId]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    if (quizzes[0].teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden.' });
    }

    await pool.query("UPDATE quizzes SET status = 'closed' WHERE id = ?", [quizId]);

    res.json({ message: 'Quiz has been stopped and closed successfully.' });
  } catch (error) {
    console.error('Error closing quiz:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
