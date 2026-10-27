import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePopup } from '../context/PopupContext';
import { API_BASE_URL } from '../config';

export default function QuizAnalytics() {
  const { id } = useParams();
  const { token } = useAuth();
  const { showConfirm, showToast } = usePopup();

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [attemptDetails, setAttemptDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${id}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load analytics.');
      }
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [id]);

  const handleCloseQuiz = async () => {
    const confirmed = await showConfirm({
      title: 'Stop / Close Quiz',
      message: 'Close this quiz now? Students will immediately view their scores according to release settings.',
      confirmText: 'Close Quiz',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${id}/close`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to close quiz.');
      }
      showToast('Quiz has been closed.', 'success');
      fetchAnalytics();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const viewAttemptDetails = async (attemptId) => {
    setSelectedAttempt(attemptId);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/attempts/detail/${attemptId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch response details.');
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

      fetchAnalytics();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading performance analytics...</span>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="container mt-30">
        <div className="alert alert-danger">{error || 'Could not load analytics.'}</div>
        <Link to="/teacher/dashboard" className="btn btn-secondary mt-10">&larr; Back to Dashboard</Link>
      </div>
    );
  }

  const { quiz, stats, distribution, leaderboard, question_stats } = analytics;
  const isClosed = quiz.status === 'closed' || (quiz.end_date && new Date(quiz.end_date) < new Date());
  const maxScore = quiz.total_questions || (question_stats ? question_stats.length : 1);

  // Highest count in distribution for relative bar scaling
  const maxDistCount = Math.max(...Object.values(distribution || {}), 1);

  return (
    <div className="container">
      {/* Back button */}
      <div className="mb-15">
        <Link to="/teacher/dashboard" className="nav-back-link">
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="page-header-row">
        <div>
          <span className="section-badge">Performance Intelligence</span>
          <h1 className="page-title">{quiz.title}</h1>
          <p className="page-subtitle">Evaluation metrics, score distribution, and student leaderboard.</p>
        </div>
        <div className="btn-group">
          <Link to={`/teacher/quiz/${quiz.id}/submissions`} className="btn btn-secondary">
            📋 Submissions List
          </Link>
          {!isClosed && (
            <button onClick={handleCloseQuiz} className="btn btn-danger-soft">
              Stop / Close Quiz
            </button>
          )}
        </div>
      </div>

      {/* Top Status Strip */}
      <div className="analytics-status-strip mb-20">
        <div className="strip-item">
          <span className="strip-label">Status:</span>
          <span className={`status-pill ${isClosed ? 'pill-closed' : 'pill-active'}`}>
            {isClosed ? '✓ Closed' : '● Open / Active'}
          </span>
        </div>
        {quiz.end_date && (
          <div className="strip-item">
            <span className="strip-label">Deadline:</span>
            <strong>{new Date(quiz.end_date).toLocaleString()}</strong>
          </div>
        )}
        <div className="strip-item">
          <span className="strip-label">Results Policy:</span>
          <span className="strip-badge">
            {quiz.results_policy === 'immediate_full' ? 'Instant Full Review' : quiz.results_policy === 'immediate_score_only' ? 'Instant Score Only' : 'On Quiz End'}
          </span>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="stats-row mb-25">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">👥</div>
          <div>
            <div className="stat-value">{stats.total_attempts}</div>
            <div className="stat-label">Total Submissions</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-green">🎯</div>
          <div>
            <div className="stat-value">{stats.avg_score} <span className="text-sm text-muted">/ {maxScore}</span></div>
            <div className="stat-label">Average Score</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-purple">📈</div>
          <div>
            <div className="stat-value">{stats.pass_rate}%</div>
            <div className="stat-label">Pass Rate (&ge; 50%)</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon stat-icon-blue">🏆</div>
          <div>
            <div className="stat-value">{stats.highest_score} <span className="text-sm text-muted">/ {maxScore}</span></div>
            <div className="stat-label">Top Score (Lowest: {stats.lowest_score})</div>
          </div>
        </div>
      </div>

      {/* Two Column Grid: Score Distribution Graph & Question Accuracy */}
      <div className="analytics-grid-2col mb-25">
        {/* 1. Score Distribution Bar Chart */}
        <div className="panel-card">
          <div className="panel-head-between mb-15">
            <h3 className="panel-title" style={{ margin: 0 }}>📊 Score Distribution</h3>
            <span className="text-muted text-sm">{stats.total_attempts} attempts</span>
          </div>

          <div className="chart-bar-container">
            {Object.entries(distribution).map(([range, count]) => {
              const barHeightPct = Math.max(12, Math.round((count / maxDistCount) * 100));
              return (
                <div key={range} className="chart-bar-column">
                  <div className="chart-bar-val">{count}</div>
                  <div className="chart-bar-track">
                    <div
                      className="chart-bar-fill"
                      style={{ height: `${barHeightPct}%` }}
                      title={`${count} students scored in ${range}`}
                    ></div>
                  </div>
                  <div className="chart-bar-label">{range}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Question Difficulty & Accuracy Rates */}
        <div className="panel-card">
          <div className="panel-head-between mb-15">
            <h3 className="panel-title" style={{ margin: 0 }}>🎯 Question Accuracy</h3>
            <span className="text-muted text-sm">{question_stats.length} questions</span>
          </div>

          <div className="question-accuracy-list">
            {question_stats.map((q) => (
              <div key={q.question_id} className="accuracy-item">
                <div className="accuracy-item-head">
                  <span className="q-badge">Q{q.index}</span>
                  <span className="q-snippet">{q.question_text}</span>
                  <span className={`diff-tag diff-${q.difficulty.toLowerCase()}`}>
                    {q.accuracy_percent}% ({q.difficulty})
                  </span>
                </div>
                <div className="accuracy-bar-track">
                  <div
                    className={`accuracy-bar-fill fill-${q.difficulty.toLowerCase()}`}
                    style={{ width: `${q.accuracy_percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Leaderboard Table */}
      <div className="panel-card">
        <div className="panel-head-between mb-15">
          <div>
            <h3 className="panel-title" style={{ margin: 0 }}>🏆 Student Leaderboard</h3>
            <p className="text-muted text-sm mt-4">Rankings based on highest score and earliest completion.</p>
          </div>
          <span className="section-badge">Top Performers</span>
        </div>

        {leaderboard.length === 0 ? (
          <div className="empty-state-card" style={{ padding: '30px 20px' }}>
            <div className="empty-icon">⏳</div>
            <h4>No Attempts Yet</h4>
            <p className="empty-desc">Once students submit, the rankings will populate here.</p>
          </div>
        ) : (
          <div className="table-responsive card-table">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Rank</th>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Submitted At</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => {
                  let rankBadge = `#${entry.rank}`;
                  let rankClass = 'rank-normal';
                  if (entry.rank === 1) {
                    rankBadge = '🥇 1st';
                    rankClass = 'rank-gold';
                  } else if (entry.rank === 2) {
                    rankBadge = '🥈 2nd';
                    rankClass = 'rank-silver';
                  } else if (entry.rank === 3) {
                    rankBadge = '🥉 3rd';
                    rankClass = 'rank-bronze';
                  }

                  return (
                    <tr key={entry.rank} className={entry.rank <= 3 ? 'tr-top-rank' : ''}>
                      <td>
                        <span className={`rank-chip ${rankClass}`}>{rankBadge}</span>
                      </td>
                      <td>
                        <div className="user-table-cell">
                          <div className={`mini-avatar ${entry.rank === 1 ? 'avatar-gold' : ''}`}>
                            {entry.student_name?.charAt(0) || 'S'}
                          </div>
                          <strong>{entry.student_name}</strong>
                        </div>
                      </td>
                      <td className="text-muted">{entry.student_email}</td>
                      <td>
                        <span className="score-value">{entry.score} / {entry.total_questions}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${entry.percentage >= 70 ? 'pill-active' : entry.percentage >= 50 ? 'pill-neutral' : 'pill-danger'}`}>
                          {entry.percentage}%
                        </span>
                      </td>
                      <td className="text-muted text-sm">
                        {new Date(entry.submitted_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => viewAttemptDetails(entry.attempt_id)}
                          title="Inspect student's evaluated response sheet"
                        >
                          📄 Inspect Sheet
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
