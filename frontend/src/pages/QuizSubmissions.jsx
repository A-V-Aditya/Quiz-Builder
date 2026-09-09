import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export default function QuizSubmissions() {
  const { id } = useParams();
  const { token } = useAuth();

  const [quiz, setQuiz] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [attemptDetails, setAttemptDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/attempts/quiz/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch submissions.');
      }
      setQuiz(data.quiz);
      setSubmissions(data.submissions);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [id]);

  const handleCloseQuiz = async () => {
    const confirmClose = window.confirm(
      'Are you sure you want to close this quiz now?\nStudents will immediately be able to view their scores and correct answers!'
    );
    if (!confirmClose) return;

    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${id}/close`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to close quiz.');
      }
      alert('Quiz has been closed!');
      fetchSubmissions();
    } catch (err) {
      alert(err.message);
    }
  };

  const viewAttemptDetails = async (attemptId) => {
    setSelectedAttempt(attemptId);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/attempts/detail/${attemptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch attempt details.');
      }
      setAttemptDetails(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <div className="container py-30 text-center">Loading quiz submissions...</div>;
  }

  return (
    <div className="container">
      <div className="nav-breadcrumb mb-10">
        <Link to="/teacher/dashboard">&larr; Back to Teacher Dashboard</Link>
      </div>

      <div className="card mb-20">
        <div className="quiz-header-flex">
          <div>
            <h2>{quiz?.title}</h2>
            {quiz?.description && <p className="subtitle">{quiz.description}</p>}
            <p className="meta-text">
              Status:{' '}
              <span className={`badge ${quiz?.status === 'open' ? 'badge-success' : 'badge-secondary'}`}>
                {quiz?.status?.toUpperCase()}
              </span>
              {' '} | Total Submissions: <strong>{submissions.length}</strong>
            </p>
          </div>
          <div>
            {quiz?.status === 'open' && (
              <button onClick={handleCloseQuiz} className="btn btn-danger">
                Close Quiz
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card mb-20">
        <h3>Student Submissions & Scores</h3>
        {submissions.length === 0 ? (
          <p className="text-center py-20 text-muted">No students have submitted this quiz yet.</p>
        ) : (
          <div className="table-responsive">
            <table className="quiz-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Submitted At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, idx) => (
                  <tr key={sub.attempt_id}>
                    <td>{idx + 1}</td>
                    <td><strong>{sub.student_name}</strong></td>
                    <td>{sub.student_email}</td>
                    <td>
                      <span className="score-highlight">
                        {sub.score} / {sub.total_questions}
                      </span>
                    </td>
                    <td>{sub.percentage}%</td>
                    <td>{new Date(sub.submitted_at).toLocaleString()}</td>
                    <td>
                      <button
                        onClick={() => viewAttemptDetails(sub.attempt_id)}
                        className="btn btn-secondary btn-sm"
                      >
                        {selectedAttempt === sub.attempt_id ? 'Hide Details' : 'View Answers'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student Detailed Answers Modal / Section */}
      {selectedAttempt && attemptDetails && (
        <div className="card mt-20" style={{ border: '2px solid #0056b3' }}>
          <div className="detail-header">
            <h3>Submission Review: {attemptDetails.attempt.student_name}</h3>
            <button
              onClick={() => { setSelectedAttempt(null); setAttemptDetails(null); }}
              className="btn btn-secondary btn-sm"
            >
              Close Review
            </button>
          </div>
          <p>
            Total Score: <strong>{attemptDetails.attempt.score} / {attemptDetails.attempt.total_questions}</strong>
          </p>

          <div className="review-questions">
            {attemptDetails.answers.map((ans, i) => (
              <div key={i} className={`answer-item card ${ans.is_correct ? 'border-success' : 'border-danger'} mb-10`}>
                <p><strong>Q{i + 1}: {ans.question_text}</strong></p>
                <div className="review-options">
                  <div className={ans.selected_option === 'A' ? 'chosen-option' : ''}>A: {ans.option_a}</div>
                  <div className={ans.selected_option === 'B' ? 'chosen-option' : ''}>B: {ans.option_b}</div>
                  <div className={ans.selected_option === 'C' ? 'chosen-option' : ''}>C: {ans.option_c}</div>
                  <div className={ans.selected_option === 'D' ? 'chosen-option' : ''}>D: {ans.option_d}</div>
                </div>
                <div className="answer-status-tag mt-10">
                  <span>Student Answer: <strong>Option {ans.selected_option}</strong></span>
                  {' | '}
                  <span>Correct Answer: <strong>Option {ans.correct_option}</strong></span>
                  {' | '}
                  <span className={ans.is_correct ? 'text-success' : 'text-danger'}>
                    {ans.is_correct ? 'Correct (+1)' : 'Incorrect (0)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
