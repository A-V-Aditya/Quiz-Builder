import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePopup } from '../context/PopupContext';
import { API_BASE_URL } from '../config';

export default function QuizSubmissions() {
  const { id } = useParams();
  const { token } = useAuth();
  const { showConfirm, showToast } = usePopup();

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
      setSubmissions(data.submissions || []);
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
    const confirmed = await showConfirm({
      title: 'Stop / Close Quiz',
      message: 'Stop this quiz now? Submissions will be locked and results released to students.',
      confirmText: 'Stop Quiz',
      isDanger: true
    });
    if (!confirmed) return;

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
      showToast('Quiz closed successfully!', 'success');
      fetchSubmissions();
    } catch (err) {
      showToast(err.message, 'danger');
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
        throw new Error(data.message || 'Failed to fetch details.');
      }
      setAttemptDetails(data);
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateGrade = async (questionId, isCorrect) => {
    try {
      const res = await fetch(`${API_BASE_URL}/attempts/grade-answer`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          attemptId: selectedAttempt,
          questionId,
          is_correct: isCorrect,
          feedback: isCorrect ? 'Full marks awarded by teacher.' : '0 marks awarded by teacher.'
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update grade.');
      }
      showToast('Mark updated successfully!', 'success');

      setAttemptDetails(prev => {
        if (!prev) return prev;
        const updatedBreakdown = (prev.breakdown || []).map(b => {
          if (b.question_id === questionId) {
            return {
              ...b,
              is_correct: isCorrect,
              feedback: data.feedback || (isCorrect ? 'Full marks awarded by teacher.' : '0 marks awarded by teacher.'),
              graded_by: 'teacher'
            };
          }
          return b;
        });
        const newScore = updatedBreakdown.filter(b => b.is_correct).length;
        return {
          ...prev,
          attempt: {
            ...prev.attempt,
            score: newScore
          },
          breakdown: updatedBreakdown
        };
      });

      fetchSubmissions();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const totalSubmissions = submissions.length;
  const avgScore = totalSubmissions > 0
    ? Math.round(submissions.reduce((acc, curr) => acc + curr.score, 0) / totalSubmissions)
    : 0;
  const maxScore = quiz?.total_questions || 0;
  const avgPercentage = maxScore > 0 ? Math.round((avgScore / maxScore) * 100) : 0;
  const isClosed = quiz?.status === 'closed' || (quiz?.end_date && new Date(quiz.end_date) < new Date());

  return (
    <div className="container">
      {/* Back button */}
      <div className="mb-15">
        <Link to="/teacher/dashboard" className="nav-back-link">
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <span className="section-badge">Grading & Results</span>
          <h1 className="page-title">{quiz?.title || 'Quiz Submissions'}</h1>
          <p className="page-subtitle">Track student submissions, performance scores, and answer keys.</p>
        </div>
        <div className="btn-group">
          <Link to={`/teacher/quiz/${id}/analytics`} className="btn btn-primary" title="View visual charts & leaderboard">
            📊 View Analytics & Leaderboard
          </Link>
          {!isClosed && (
            <button onClick={handleCloseQuiz} className="btn btn-danger-soft">
              Stop Quiz
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Stats Summary */}
      <div className="stats-row mb-25">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">👥</div>
          <div>
            <div className="stat-value">{totalSubmissions}</div>
            <div className="stat-label">Total Submissions</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">
            {isClosed ? '🔒' : '🟢'}
          </div>
          <div>
            <div className="stat-value">{isClosed ? 'Closed' : 'Open'}</div>
            <div className="stat-label">Quiz Status</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading submissions...</span>
        </div>
      ) : submissions.length === 0 ? (
        <div className="empty-state-card">
          <div className="empty-icon">⏳</div>
          <h3>No Submissions Yet</h3>
          <p className="empty-desc">Students have not submitted any attempts for this quiz yet.</p>
        </div>
      ) : (
        <div className="table-responsive card-table">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Submitted</th>
                <th>Score</th>
                <th>Percentage</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => {
                const percent = sub.total_questions > 0
                  ? Math.round((sub.score / sub.total_questions) * 100)
                  : 0;

                return (
                  <tr key={sub.attempt_id || sub.id}>
                    <td>
                      <div className="user-table-cell">
                        <div className="mini-avatar">{sub.student_name?.charAt(0) || 'S'}</div>
                        <strong>{sub.student_name}</strong>
                      </div>
                    </td>
                    <td className="text-muted">{sub.student_email}</td>
                    <td>{new Date(sub.submitted_at).toLocaleDateString()}</td>
                    <td>
                      <span className="score-value">{sub.score} / {sub.total_questions}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${percent >= 70 ? 'pill-active' : percent >= 40 ? 'pill-neutral' : 'pill-danger'}`}>
                        {percent}%
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => viewAttemptDetails(sub.attempt_id || sub.id)}
                        className="btn btn-sm btn-secondary"
                      >
                        Inspect Sheet
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Answer Sheet Modal */}
      {selectedAttempt && (
        <div className="modal-overlay" onClick={() => setSelectedAttempt(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="section-badge">Student Submission</span>
                <h3 className="modal-title">
                  {attemptDetails?.student?.name} &bull; Score: {attemptDetails?.attempt?.score} / {attemptDetails?.attempt?.total_questions}
                </h3>
              </div>
              <button onClick={() => setSelectedAttempt(null)} className="btn-close-modal">
                &times;
              </button>
            </div>

            <div className="modal-body">
              {detailLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <span>Loading response sheet...</span>
                </div>
              ) : attemptDetails ? (
                <div className="review-list">
                  {attemptDetails.breakdown?.map((item, index) => {
                    const qType = item.question_type || 'single';
                    const selectedList = (item.selected_option || '').split(',').map(s => s.trim().toUpperCase());
                    const correctList = (item.correct_option || '').split(',').map(s => s.trim().toUpperCase());

                    return (
                      <div
                        key={item.question_id}
                        className={`review-card ${item.is_correct ? 'card-pass' : 'card-fail'}`}
                      >
                        <div className="review-card-head">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="question-idx-badge">Q{index + 1}</span>
                            <span className="type-badge-pill">
                              {qType === 'multiple' ? 'Multiple Choice' : qType === 'descriptive' ? 'Descriptive' : 'Single Choice'}
                            </span>
                          </div>
                          <span className={`result-chip ${item.is_correct ? 'chip-correct' : 'chip-wrong'}`}>
                            {item.is_correct ? '✓ Correct' : '✕ Incorrect'}
                          </span>
                        </div>

                        <p className="review-prompt">{item.question_text}</p>

                        {/* Image Preview */}
                        {item.image_url && (
                          <div className="review-image-wrap mb-10">
                            <img src={item.image_url} alt={`Question ${index + 1}`} className="img-thumbnail" />
                          </div>
                        )}

                        {/* Descriptive Answer Sheet */}
                        {qType === 'descriptive' ? (
                          <div className="review-descriptive-box">
                            <div className="descriptive-eval-meta-row mb-10">
                              <span className={`chip-badge ${item.grading_mode === 'ai' ? 'chip-ai' : 'chip-teacher'}`}>
                                {item.grading_mode === 'ai' ? '🤖 AI Evaluated' : '👨‍🏫 Teacher Manual Grading'}
                              </span>
                              <span className="text-muted text-sm">
                                Graded by: <strong>{item.graded_by === 'ai' ? 'AI Model' : item.graded_by === 'teacher' ? 'Instructor (Manual)' : 'Default (Full)'}</strong>
                              </span>
                            </div>

                            <div className="descriptive-review-block">
                              <span className="descriptive-sub-label">Student Written Response:</span>
                              <div className="student-written-response">
                                {item.selected_option ? item.selected_option : <em className="text-muted">(No response provided)</em>}
                              </div>
                            </div>

                            {item.correct_option && (
                              <div className="descriptive-review-block mt-10">
                                <span className="descriptive-sub-label">Teacher Rubric / Reference Answer:</span>
                                <div className="instructor-reference-answer">
                                  {item.correct_option}
                                </div>
                              </div>
                            )}

                            {item.feedback && (
                              <div className="eval-feedback-callout mt-10">
                                <span className="feedback-label">
                                  {item.graded_by === 'ai' ? '🤖 AI Assessment Feedback:' : '💬 Evaluation Note:'}
                                </span>
                                <p className="feedback-text">{item.feedback}</p>
                              </div>
                            )}

                            {/* Live Teacher Mark Adjustment */}
                            <div className="teacher-grade-bar mt-12">
                              <span className="grade-bar-title">Teacher Mark:</span>
                              <div className="grade-toggle-group">
                                <button
                                  type="button"
                                  className={`btn-grade-toggle ${item.is_correct ? 'active-pass' : ''}`}
                                  onClick={() => handleUpdateGrade(item.question_id, true)}
                                >
                                  ✓ Full Mark (1 Pt)
                                </button>
                                <button
                                  type="button"
                                  className={`btn-grade-toggle ${!item.is_correct ? 'active-fail' : ''}`}
                                  onClick={() => handleUpdateGrade(item.question_id, false)}
                                >
                                  ✕ 0 Marks
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Single / Multiple Options Grid */
                          <div className="review-options-grid">
                            {(['A', 'B', 'C', 'D']).map((letter) => {
                              const optKey = `option_${letter.toLowerCase()}`;
                              const isSelected = selectedList.includes(letter);
                              const isCorrectOpt = correctList.includes(letter);

                              let optClass = 'opt-neutral';
                              if (isCorrectOpt) optClass = 'opt-key-correct';
                              else if (isSelected && !isCorrectOpt) optClass = 'opt-key-wrong';

                              return (
                                <div key={letter} className={`review-opt-item ${optClass}`}>
                                  <span className="opt-letter">{qType === 'multiple' ? (isSelected ? '☑' : '☐') : letter}</span>
                                  <span className="opt-desc">{item[optKey]}</span>
                                  {isCorrectOpt && <span className="opt-badge-pill">Correct Answer</span>}
                                  {isSelected && !isCorrectOpt && <span className="opt-badge-pill badge-err">Student Pick</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
