import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export default function StudentHistory() {
  const { user, token } = useAuth();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [reviewDetails, setReviewDetails] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchAttempts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/attempts/student`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch your quiz attempts.');
      }
      setAttempts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttempts();
  }, []);

  const handleViewReview = async (attemptId) => {
    setSelectedAttempt(attemptId);
    setReviewLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/attempts/detail/${attemptId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load details.');
      }
      setReviewDetails(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="dashboard-header">
        <div>
          <h2>My Past Quizzes & Scores</h2>
          <p className="subtitle">Track your attempted quizzes and review published scores.</p>
        </div>
        <div>
          <Link to="/student/dashboard" className="btn btn-secondary">
            &larr; Back to Available Quizzes
          </Link>
        </div>
      </div>

      <div className="alert alert-info">
        <strong>Note on Scores:</strong> As per evaluation policy, your score is released only after your teacher closes the quiz!
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <p className="text-center py-20">Loading your history...</p>
      ) : attempts.length === 0 ? (
        <div className="card text-center py-30">
          <h3>No Quizzes Attempted Yet</h3>
          <p className="text-muted mt-10">You haven't attempted any quizzes yet.</p>
          <Link to="/student/dashboard" className="btn btn-primary mt-20">
            Browse Available Quizzes
          </Link>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="quiz-table">
            <thead>
              <tr>
                <th>Quiz Title</th>
                <th>Instructor</th>
                <th>Submitted On</th>
                <th>Quiz Status</th>
                <th>Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((att) => {
                const isClosed = att.quiz_status === 'closed';
                const percentage = isClosed
                  ? ((att.score / att.total_questions) * 100).toFixed(1)
                  : null;

                return (
                  <tr key={att.attempt_id}>
                    <td>
                      <strong>{att.quiz_title}</strong>
                      {att.quiz_description && (
                        <p className="quiz-desc-preview">{att.quiz_description}</p>
                      )}
                    </td>
                    <td>{att.teacher_name}</td>
                    <td>{new Date(att.submitted_at).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${isClosed ? 'badge-secondary' : 'badge-success'}`}>
                        {att.quiz_status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {isClosed ? (
                        <span className="score-badge">
                          <strong>{att.score} / {att.total_questions}</strong> ({percentage}%)
                        </span>
                      ) : (
                        <span className="pending-score">
                          Pending (Teacher hasn't closed quiz yet)
                        </span>
                      )}
                    </td>
                    <td>
                      {isClosed ? (
                        <button
                          onClick={() => handleViewReview(att.attempt_id)}
                          className="btn btn-secondary btn-sm"
                        >
                          {selectedAttempt === att.attempt_id ? 'Hide Solution' : 'View Solution'}
                        </button>
                      ) : (
                        <span className="text-muted text-sm">Awaiting Close</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review details for closed quiz */}
      {selectedAttempt && reviewDetails && (
        <div className="card mt-20" style={{ border: '2px solid #28a745' }}>
          <div className="detail-header">
            <h3>Detailed Solution Review: {reviewDetails.attempt.quiz_title}</h3>
            <button
              onClick={() => { setSelectedAttempt(null); setReviewDetails(null); }}
              className="btn btn-secondary btn-sm"
            >
              Close Solution
            </button>
          </div>
          <p className="mb-20">
            Final Score: <strong>{reviewDetails.attempt.score} / {reviewDetails.attempt.total_questions}</strong>
          </p>

          <div className="review-questions">
            {reviewDetails.answers.map((ans, i) => (
              <div
                key={i}
                className={`answer-item card ${ans.is_correct ? 'border-success' : 'border-danger'} mb-10`}
              >
                <p><strong>Q{i + 1}: {ans.question_text}</strong></p>
                <div className="review-options">
                  <div className={ans.selected_option === 'A' ? 'chosen-option' : ''}>A: {ans.option_a}</div>
                  <div className={ans.selected_option === 'B' ? 'chosen-option' : ''}>B: {ans.option_b}</div>
                  <div className={ans.selected_option === 'C' ? 'chosen-option' : ''}>C: {ans.option_c}</div>
                  <div className={ans.selected_option === 'D' ? 'chosen-option' : ''}>D: {ans.option_d}</div>
                </div>
                <div className="answer-status-tag mt-10">
                  <span>Your Answer: <strong>Option {ans.selected_option || 'None'}</strong></span>
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
