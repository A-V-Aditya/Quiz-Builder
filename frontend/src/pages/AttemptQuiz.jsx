import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export default function AttemptQuiz() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // { [question_id]: 'A' | 'B' | 'C' | 'D' }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuiz = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE_URL}/quizzes/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to load quiz.');
        }

        if (data.quiz.status !== 'open') {
          throw new Error('This quiz is closed and no longer accepting attempts.');
        }

        setQuiz(data.quiz);
        setQuestions(data.questions);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id, token]);

  const handleOptionChange = (questionId, option) => {
    setAnswers({
      ...answers,
      [questionId]: option
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if all questions have been answered
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      const confirmIncomplete = window.confirm(
        `You have unanswered questions (${unanswered.length} left). Are you sure you want to submit?`
      );
      if (!confirmIncomplete) return;
    } else {
      const confirmSubmit = window.confirm('Are you ready to submit your answers?');
      if (!confirmSubmit) return;
    }

    setSubmitting(true);
    setError('');

    // Format answers array
    const formattedAnswers = questions.map(q => ({
      question_id: q.id,
      selected_option: answers[q.id] || ''
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/attempts/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          quiz_id: id,
          answers: formattedAnswers
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit quiz.');
      }

      alert('Quiz submitted successfully!\n\nYour score will become visible once the instructor closes the quiz.');
      navigate('/student/history');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="container py-30 text-center">Loading quiz questions...</div>;
  }

  if (error && !quiz) {
    return (
      <div className="container py-30">
        <div className="alert alert-danger">{error}</div>
        <Link to="/student/dashboard" className="btn btn-secondary mt-10">&larr; Back to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="nav-breadcrumb mb-10">
        <Link to="/student/dashboard">&larr; Cancel and Return to Dashboard</Link>
      </div>

      <div className="card mb-20">
        <h2>{quiz?.title}</h2>
        {quiz?.description && <p className="subtitle">{quiz.description}</p>}
        <div className="quiz-meta mt-10">
          <span>Instructor: <strong>{quiz?.teacher_name}</strong></span>
          <span>Total Questions: <strong>{questions.length}</strong></span>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        {questions.map((q, idx) => (
          <div key={q.id} className="card question-card mb-20">
            <h4 className="question-title">
              <span className="q-number">Question {idx + 1} of {questions.length}:</span>
              <br />
              {q.question_text}
            </h4>

            <div className="options-container">
              <label className={`option-item ${answers[q.id] === 'A' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name={`question_${q.id}`}
                  value="A"
                  checked={answers[q.id] === 'A'}
                  onChange={() => handleOptionChange(q.id, 'A')}
                />
                <span className="option-letter">A.</span>
                <span className="option-text">{q.option_a}</span>
              </label>

              <label className={`option-item ${answers[q.id] === 'B' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name={`question_${q.id}`}
                  value="B"
                  checked={answers[q.id] === 'B'}
                  onChange={() => handleOptionChange(q.id, 'B')}
                />
                <span className="option-letter">B.</span>
                <span className="option-text">{q.option_b}</span>
              </label>

              <label className={`option-item ${answers[q.id] === 'C' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name={`question_${q.id}`}
                  value="C"
                  checked={answers[q.id] === 'C'}
                  onChange={() => handleOptionChange(q.id, 'C')}
                />
                <span className="option-letter">C.</span>
                <span className="option-text">{q.option_c}</span>
              </label>

              <label className={`option-item ${answers[q.id] === 'D' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name={`question_${q.id}`}
                  value="D"
                  checked={answers[q.id] === 'D'}
                  onChange={() => handleOptionChange(q.id, 'D')}
                />
                <span className="option-letter">D.</span>
                <span className="option-text">{q.option_d}</span>
              </label>
            </div>
          </div>
        ))}

        <div className="card text-center mb-30">
          <p className="mb-10 text-muted">
            Questions answered: {Object.keys(answers).length} of {questions.length}
          </p>
          <button
            type="submit"
            className="btn btn-primary btn-large"
            disabled={submitting}
          >
            {submitting ? 'Submitting Answers...' : 'Submit Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
}
