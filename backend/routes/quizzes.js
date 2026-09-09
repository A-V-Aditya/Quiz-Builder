const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireTeacher, requireStudent } = require('../middleware/auth');

// 1. Create a Quiz (Teacher only)
router.post('/', verifyToken, requireTeacher, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { title, description, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Title and at least one question are required.' });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_option) {
        return res.status(400).json({ message: `Question #${i + 1} is missing required fields.` });
      }
      if (!['A', 'B', 'C', 'D'].includes(q.correct_option.toUpperCase())) {
        return res.status(400).json({ message: `Question #${i + 1} has invalid correct_option. Must be A, B, C, or D.` });
      }
    }

    await connection.beginTransaction();

    // Insert Quiz
    const [quizResult] = await connection.query(
      'INSERT INTO quizzes (teacher_id, title, description, status) VALUES (?, ?, ?, "open")',
      [req.user.id, title, description || '']
    );
    const quizId = quizResult.insertId;

    // Insert Questions
    for (const q of questions) {
      await connection.query(
        'INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [quizId, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option.toUpperCase()]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: 'Quiz created successfully!',
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

// 2. Get Quizzes created by Teacher (All, Open, or Closed with counts)
router.get('/teacher', verifyToken, requireTeacher, async (req, res) => {
  try {
    const query = `
      SELECT 
        q.id,
        q.title,
        q.description,
        q.status,
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
    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching teacher quizzes:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 3. Get Open Quizzes available for Student to attempt
router.get('/available', verifyToken, requireStudent, async (req, res) => {
  try {
    // Return open quizzes that the student has not attempted yet
    const query = `
      SELECT 
        q.id,
        q.title,
        q.description,
        q.status,
        q.created_at,
        u.name AS teacher_name,
        COUNT(DISTINCT qu.id) AS total_questions
      FROM quizzes q
      JOIN users u ON q.teacher_id = u.id
      LEFT JOIN questions qu ON q.id = qu.quiz_id
      WHERE q.status = 'open'
        AND q.id NOT IN (
          SELECT quiz_id FROM attempts WHERE student_id = ?
        )
      GROUP BY q.id
      ORDER BY q.created_at DESC
    `;
    const [quizzes] = await pool.query(query, [req.user.id]);
    res.json(quizzes);
  } catch (error) {
    console.error('Error fetching available quizzes:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 4. Get Quiz Details & Questions (for Student to attempt or Teacher to view)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const quizId = req.params.id;

    // Fetch quiz info
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

    // If teacher is viewing, they must be the author
    if (req.user.role === 'teacher' && quiz.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden. You did not create this quiz.' });
    }

    // Fetch questions
    // If student is fetching and quiz is still open / attempting: do not return correct_option
    let questionsQuery;
    if (req.user.role === 'teacher') {
      questionsQuery = 'SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option FROM questions WHERE quiz_id = ?';
    } else {
      questionsQuery = 'SELECT id, question_text, option_a, option_b, option_c, option_d FROM questions WHERE quiz_id = ?';
    }

    const [questions] = await pool.query(questionsQuery, [quizId]);

    res.json({
      quiz,
      questions
    });
  } catch (error) {
    console.error('Error fetching quiz details:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 5. Close a Quiz (Teacher only)
router.patch('/:id/close', verifyToken, requireTeacher, async (req, res) => {
  try {
    const quizId = req.params.id;

    // Verify ownership
    const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE id = ?', [quizId]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    if (quizzes[0].teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden. You can only close your own quizzes.' });
    }

    await pool.query('UPDATE quizzes SET status = "closed" WHERE id = ?', [quizId]);

    res.json({ message: 'Quiz has been closed successfully. Students can now view their scores!' });
  } catch (error) {
    console.error('Error closing quiz:', error);
    res.status(500).json({ message: 'Internal server error while closing quiz.' });
  }
});

module.exports = router;
