const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireStudent, requireTeacher } = require('../middleware/auth');

// 1. Submit a Quiz Attempt (Student only)
router.post('/submit', verifyToken, requireStudent, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { quiz_id, answers } = req.body;

    if (!quiz_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Quiz ID and answers array are required.' });
    }

    // Check if quiz exists and is open
    const [quizzes] = await connection.query('SELECT * FROM quizzes WHERE id = ?', [quiz_id]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    const quiz = quizzes[0];
    if (quiz.status !== 'open') {
      return res.status(400).json({ message: 'This quiz is closed and no longer accepting submissions.' });
    }

    // Check if student has already submitted
    const [existingAttempts] = await connection.query(
      'SELECT id FROM attempts WHERE quiz_id = ? AND student_id = ?',
      [quiz_id, req.user.id]
    );

    if (existingAttempts.length > 0) {
      return res.status(400).json({ message: 'You have already attempted this quiz.' });
    }

    // Fetch questions and correct options from database
    const [questions] = await connection.query(
      'SELECT id, correct_option FROM questions WHERE quiz_id = ?',
      [quiz_id]
    );

    if (questions.length === 0) {
      return res.status(400).json({ message: 'This quiz does not have any questions.' });
    }

    // Map correct options
    const correctMap = {};
    questions.forEach(q => {
      correctMap[q.id] = q.correct_option;
    });

    let score = 0;
    const evaluatedAnswers = [];

    // Calculate score
    for (const ans of answers) {
      const qId = ans.question_id;
      const selected = ans.selected_option ? ans.selected_option.toUpperCase() : '';
      const isCorrect = (correctMap[qId] && correctMap[qId] === selected) ? true : false;
      if (isCorrect) {
        score++;
      }
      evaluatedAnswers.push({
        question_id: qId,
        selected_option: selected,
        is_correct: isCorrect
      });
    }

    await connection.beginTransaction();

    // Insert into attempts
    const [attemptResult] = await connection.query(
      'INSERT INTO attempts (quiz_id, student_id, score, total_questions) VALUES (?, ?, ?, ?)',
      [quiz_id, req.user.id, score, questions.length]
    );
    const attemptId = attemptResult.insertId;

    // Insert answers into attempt_answers
    for (const ea of evaluatedAnswers) {
      await connection.query(
        'INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct) VALUES (?, ?, ?, ?)',
        [attemptId, ea.question_id, ea.selected_option, ea.is_correct]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: 'Quiz submitted successfully! Your score will be available once the teacher closes the quiz.',
      attemptId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error submitting quiz attempt:', error);
    res.status(500).json({ message: 'Internal server error while submitting quiz.' });
  } finally {
    connection.release();
  }
});

// 2. Get Past Quizzes Attempted by Current Student
// NOTE: According to requirement: when teacher closes quiz, student can look at their score.
router.get('/student', verifyToken, requireStudent, async (req, res) => {
  try {
    const query = `
      SELECT 
        a.id AS attempt_id,
        a.quiz_id,
        q.title AS quiz_title,
        q.description AS quiz_description,
        q.status AS quiz_status,
        u.name AS teacher_name,
        a.total_questions,
        a.submitted_at,
        CASE 
          WHEN q.status = 'closed' THEN a.score 
          ELSE NULL 
        END AS score
      FROM attempts a
      JOIN quizzes q ON a.quiz_id = q.id
      JOIN users u ON q.teacher_id = u.id
      WHERE a.student_id = ?
      ORDER BY a.submitted_at DESC
    `;

    const [attempts] = await pool.query(query, [req.user.id]);
    res.json(attempts);
  } catch (error) {
    console.error('Error fetching student attempts:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 3. Get All Student Scores for a specific Quiz (Teacher only)
router.get('/quiz/:quizId', verifyToken, requireTeacher, async (req, res) => {
  try {
    const quizId = req.params.quizId;

    // Check quiz ownership
    const [quizzes] = await pool.query('SELECT * FROM quizzes WHERE id = ?', [quizId]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    if (quizzes[0].teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden. You do not own this quiz.' });
    }

    const query = `
      SELECT 
        a.id AS attempt_id,
        u.id AS student_id,
        u.name AS student_name,
        u.email AS student_email,
        a.score,
        a.total_questions,
        ROUND((a.score / a.total_questions) * 100, 1) AS percentage,
        a.submitted_at
      FROM attempts a
      JOIN users u ON a.student_id = u.id
      WHERE a.quiz_id = ?
      ORDER BY a.score DESC, a.submitted_at ASC
    `;

    const [submissions] = await pool.query(query, [quizId]);

    res.json({
      quiz: quizzes[0],
      submissions
    });
  } catch (error) {
    console.error('Error fetching quiz submissions for teacher:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 4. Get Detailed Review of an Attempt (for student after closed, or for teacher)
router.get('/detail/:attemptId', verifyToken, async (req, res) => {
  try {
    const attemptId = req.params.attemptId;

    const [attempts] = await pool.query(
      `SELECT a.*, q.title AS quiz_title, q.status AS quiz_status, q.teacher_id, u.name AS student_name
       FROM attempts a
       JOIN quizzes q ON a.quiz_id = q.id
       JOIN users u ON a.student_id = u.id
       WHERE a.id = ?`,
      [attemptId]
    );

    if (attempts.length === 0) {
      return res.status(404).json({ message: 'Attempt not found.' });
    }

    const attempt = attempts[0];

    // Authorization check
    if (req.user.role === 'student' && attempt.student_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to view this attempt.' });
    }

    if (req.user.role === 'teacher' && attempt.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to view this attempt.' });
    }

    // If student and quiz is still open, score/breakdown is hidden
    if (req.user.role === 'student' && attempt.quiz_status === 'open') {
      return res.status(403).json({ 
        message: 'Quiz is currently open. Detailed answers and scores are released only after the teacher closes the quiz.' 
      });
    }

    // Fetch questions and answers
    const [answers] = await pool.query(
      `SELECT 
        q.id AS question_id,
        q.question_text,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_option,
        aa.selected_option,
        aa.is_correct
       FROM attempt_answers aa
       JOIN questions q ON aa.question_id = q.id
       WHERE aa.attempt_id = ?`,
      [attemptId]
    );

    res.json({
      attempt,
      answers
    });
  } catch (error) {
    console.error('Error fetching attempt details:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;
