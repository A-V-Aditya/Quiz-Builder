const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, requireStudent, requireTeacher } = require('../middleware/auth');
const { evaluateDescriptiveAnswer } = require('../services/aiService');

function normalizeOptionString(val) {
  if (!val) return '';
  if (Array.isArray(val)) {
    return val.map(v => v.toString().trim().toUpperCase()).filter(Boolean).sort().join(',');
  }
  return val
    .toString()
    .split(',')
    .map(v => v.trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join(',');
}

// 1. Submit a Quiz Attempt (Student only)
router.post('/submit', verifyToken, requireStudent, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { quiz_id, answers } = req.body;

    if (!quiz_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: 'Quiz ID and answers array are required.' });
    }

    const [quizzes] = await connection.query('SELECT * FROM quizzes WHERE id = ?', [quiz_id]);
    if (quizzes.length === 0) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    const quiz = quizzes[0];
    if (quiz.status !== 'open') {
      return res.status(400).json({ message: 'This quiz is closed and no longer accepting submissions.' });
    }

    // Check if end_date deadline has passed
    if (quiz.end_date && new Date(quiz.end_date) < new Date()) {
      return res.status(400).json({ message: 'The submission deadline for this quiz has expired.' });
    }

    // Check if student has already submitted
    const [existingAttempts] = await connection.query(
      'SELECT id FROM attempts WHERE quiz_id = ? AND student_id = ?',
      [quiz_id, req.user.id]
    );

    if (existingAttempts.length > 0) {
      return res.status(400).json({ message: 'You have already attempted this quiz.' });
    }

    // Fetch questions
    const [questions] = await connection.query(
      'SELECT id, question_type, correct_option, question_text, word_limit, grading_mode FROM questions WHERE quiz_id = ?',
      [quiz_id]
    );

    if (questions.length === 0) {
      return res.status(400).json({ message: 'This quiz does not have any questions.' });
    }

    let score = 0;
    const evaluatedAnswers = [];

    const answerMap = {};
    answers.forEach(a => {
      answerMap[a.question_id] = a.selected_option;
    });

    for (const q of questions) {
      const qId = q.id;
      const qType = q.question_type || 'single';
      const rawSelected = answerMap[qId];

      let isCorrect = false;
      let storedSelection = '';
      let feedback = null;
      let gradedBy = 'auto';

      if (qType === 'single') {
        const selected = typeof rawSelected === 'string' ? rawSelected.trim().toUpperCase() : '';
        const correct = (q.correct_option || '').trim().toUpperCase();
        isCorrect = selected && correct && selected === correct;
        storedSelection = selected;
      } else if (qType === 'multiple') {
        const selectedNorm = normalizeOptionString(rawSelected);
        const correctNorm = normalizeOptionString(q.correct_option);
        isCorrect = selectedNorm && correctNorm && selectedNorm === correctNorm;
        storedSelection = selectedNorm;
      } else if (qType === 'descriptive') {
        const textVal = typeof rawSelected === 'string' ? rawSelected.trim() : '';
        const mode = q.grading_mode || 'manual';

        if (mode === 'manual') {
          // Default full mark for teacher manual grading
          isCorrect = textVal.length > 0;
          feedback = textVal.length > 0 ? 'Full mark awarded (Teacher manual grading)' : 'No response entered';
          gradedBy = 'manual';
        } else {
          // AI grading mode: preliminary mark, evaluated asynchronously in background
          isCorrect = textVal.length > 0;
          feedback = 'AI evaluation queued...';
          gradedBy = 'ai_pending';
        }
        storedSelection = textVal;
      }

      if (isCorrect) {
        score++;
      }

      evaluatedAnswers.push({
        question_id: qId,
        selected_option: storedSelection,
        is_correct: isCorrect ? 1 : 0,
        feedback,
        graded_by: gradedBy
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
        'INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct, feedback, graded_by) VALUES (?, ?, ?, ?, ?, ?)',
        [attemptId, ea.question_id, ea.selected_option, ea.is_correct, ea.feedback, ea.graded_by]
      );
    }

    await connection.commit();

    const policy = quiz.results_policy || 'on_quiz_end';
    let feedbackMsg = 'Quiz submitted successfully!';
    let returnScore = null;

    if (policy === 'immediate_full') {
      feedbackMsg = `Quiz submitted! Your score: ${score} / ${questions.length}. Full solutions are unlocked now.`;
      returnScore = score;
    } else if (policy === 'immediate_score_only') {
      feedbackMsg = `Quiz submitted! Your score: ${score} / ${questions.length}. Solutions will unlock after the quiz ends.`;
      returnScore = score;
    } else {
      feedbackMsg = 'Quiz submitted! Results will be released once the instructor closes the quiz.';
    }

    // Immediately send response to student (No loading spinner or waiting)
    res.status(201).json({
      message: feedbackMsg,
      attemptId,
      score: returnScore,
      total_questions: questions.length,
      results_policy: policy
    });

    // Run AI Evaluation asynchronously in background
    const aiQuestions = questions.filter(q => q.question_type === 'descriptive' && q.grading_mode === 'ai');
    if (aiQuestions.length > 0) {
      setImmediate(async () => {
        try {
          for (const q of aiQuestions) {
            const rawAns = answerMap[q.id];
            const evalResult = await evaluateDescriptiveAnswer({
              questionText: q.question_text,
              rubric: q.correct_option,
              studentAnswer: rawAns,
              wordLimit: q.word_limit
            });

            await pool.query(
              `UPDATE attempt_answers 
               SET is_correct = ?, feedback = ?, graded_by = 'ai' 
               WHERE attempt_id = ? AND question_id = ?`,
              [evalResult.is_correct, evalResult.feedback, attemptId, q.id]
            );
          }

          // Recalculate and update attempt score
          const [updatedScore] = await pool.query(
            'SELECT SUM(is_correct) AS final_score FROM attempt_answers WHERE attempt_id = ?',
            [attemptId]
          );
          const finalScore = updatedScore[0]?.final_score ?? score;
          await pool.query('UPDATE attempts SET score = ? WHERE id = ?', [finalScore, attemptId]);
          console.log(`[AI Evaluation] Background grading complete for Attempt #${attemptId}. Score: ${finalScore}/${questions.length}`);
        } catch (bgErr) {
          console.error('[AI Evaluation] Error in background descriptive evaluation:', bgErr.message);
        }
      });
    }
  } catch (error) {
    await connection.rollback();
    console.error('Error submitting quiz attempt:', error);
    res.status(500).json({ message: 'Internal server error while submitting quiz.' });
  } finally {
    connection.release();
  }
});

// 2. Get Past Quizzes Attempted by Current Student
router.get('/student', verifyToken, requireStudent, async (req, res) => {
  try {
    const query = `
      SELECT 
        a.id AS attempt_id,
        a.quiz_id,
        q.title AS quiz_title,
        q.description AS quiz_description,
        q.status AS quiz_status,
        q.end_date,
        q.results_policy,
        u.name AS teacher_name,
        a.total_questions,
        a.submitted_at,
        a.score AS raw_score
      FROM attempts a
      JOIN quizzes q ON a.quiz_id = q.id
      JOIN users u ON q.teacher_id = u.id
      WHERE a.student_id = ?
      ORDER BY a.submitted_at DESC
    `;

    const [attempts] = await pool.query(query, [req.user.id]);
    const now = new Date();

    const formatted = attempts.map(att => {
      const isClosed = att.quiz_status === 'closed' || (att.end_date && new Date(att.end_date) < now);
      const policy = att.results_policy || 'on_quiz_end';

      const showScore = isClosed || policy === 'immediate_score_only' || policy === 'immediate_full';
      const canViewSolutions = isClosed || policy === 'immediate_full';

      return {
        attempt_id: att.attempt_id,
        quiz_id: att.quiz_id,
        quiz_title: att.quiz_title,
        quiz_description: att.quiz_description,
        quiz_status: isClosed ? 'closed' : 'open',
        end_date: att.end_date,
        results_policy: policy,
        teacher_name: att.teacher_name,
        total_questions: att.total_questions,
        submitted_at: att.submitted_at,
        score: showScore ? att.raw_score : null,
        can_view_solutions: canViewSolutions
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching student attempts:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 3. Get All Student Scores for a specific Quiz (Teacher only)
router.get('/quiz/:quizId', verifyToken, requireTeacher, async (req, res) => {
  try {
    const quizId = req.params.quizId;

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
        ROUND((a.score * 100.0 / CASE WHEN a.total_questions = 0 THEN 1 ELSE a.total_questions END), 1) AS percentage,
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

// 4. Get Detailed Review of an Attempt
router.get('/detail/:attemptId', verifyToken, async (req, res) => {
  try {
    const attemptId = req.params.attemptId;

    const [attempts] = await pool.query(
      `SELECT a.*, q.title AS quiz_title, q.status AS quiz_status, q.end_date, q.results_policy, q.teacher_id, u.name AS student_name
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
    const now = new Date();
    const isClosed = attempt.quiz_status === 'closed' || (attempt.end_date && new Date(attempt.end_date) < now);
    const policy = attempt.results_policy || 'on_quiz_end';

    if (req.user.role === 'student' && attempt.student_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    if (req.user.role === 'teacher' && attempt.teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    // Student solution permission check
    if (req.user.role === 'student') {
      const allowed = isClosed || policy === 'immediate_full';
      if (!allowed) {
        return res.status(403).json({ 
          message: 'Detailed answers and solutions unlock once the quiz concludes or deadline passes.' 
        });
      }
    }

    const [breakdown] = await pool.query(
      `SELECT 
        q.id AS question_id,
        q.question_text,
        q.question_type,
        q.grading_mode,
        q.image_url,
        q.word_limit,
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d,
        q.correct_option,
        aa.id AS answer_id,
        aa.selected_option,
        aa.is_correct,
        aa.feedback,
        aa.graded_by
       FROM attempt_answers aa
       JOIN questions q ON aa.question_id = q.id
       WHERE aa.attempt_id = ?
       ORDER BY q.id ASC`,
      [attemptId]
    );

    res.json({
      quiz: { id: attempt.quiz_id, title: attempt.quiz_title },
      student: { name: attempt.student_name },
      attempt,
      breakdown: breakdown.map(b => ({
        ...b,
        is_correct: Boolean(b.is_correct),
        feedback: b.feedback || '',
        graded_by: b.graded_by || 'auto',
        grading_mode: b.grading_mode || 'manual'
      }))
    });
  } catch (error) {
    console.error('Error fetching attempt details:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

// 5. Teacher Manual Grading on Descriptive Answer
router.patch('/grade-answer', verifyToken, requireTeacher, async (req, res) => {
  try {
    const { attemptId, questionId, is_correct, feedback } = req.body;
    if (!attemptId || !questionId) {
      return res.status(400).json({ message: 'attemptId and questionId are required.' });
    }

    const [attempts] = await pool.query(
      `SELECT a.id, a.quiz_id, q.teacher_id 
       FROM attempts a 
       JOIN quizzes q ON a.quiz_id = q.id 
       WHERE a.id = ?`,
      [attemptId]
    );

    if (attempts.length === 0) {
      return res.status(404).json({ message: 'Attempt not found.' });
    }

    if (attempts[0].teacher_id !== req.user.id) {
      return res.status(403).json({ message: 'Access forbidden.' });
    }

    const awardCorrect = is_correct ? 1 : 0;
    const comment = typeof feedback === 'string' ? feedback.trim() : null;

    await pool.query(
      `UPDATE attempt_answers 
       SET is_correct = ?, feedback = ?, graded_by = 'teacher' 
       WHERE attempt_id = ? AND question_id = ?`,
      [awardCorrect, comment, attemptId, questionId]
    );

    const [scoreRows] = await pool.query(
      'SELECT SUM(is_correct) AS new_score FROM attempt_answers WHERE attempt_id = ?',
      [attemptId]
    );
    const newScore = scoreRows[0]?.new_score || 0;

    await pool.query('UPDATE attempts SET score = ? WHERE id = ?', [newScore, attemptId]);

    res.json({
      message: 'Grade updated successfully.',
      attemptId,
      questionId,
      is_correct: Boolean(awardCorrect),
      feedback: comment,
      newScore
    });
  } catch (error) {
    console.error('Error grading answer:', error);
    res.status(500).json({ message: 'Failed to update grade.' });
  }
});

module.exports = router;
