import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePopup } from '../context/PopupContext';
import { API_BASE_URL } from '../config';

export default function AttemptQuiz() {
  const { id } = useParams();
  const { token } = useAuth();
  const { showConfirm, showAlert, showToast } = usePopup();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copyWarning, setCopyWarning] = useState('');

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

        if (data.quiz.is_closed || data.quiz.status !== 'open') {
          throw new Error('This quiz is closed or the deadline has expired.');
        }

        setQuiz(data.quiz);
        setQuestions(data.questions || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id, token]);

  // Anti-Cheat: Disable Copy, Cut, Text Selection, and Right-click if enabled
  useEffect(() => {
    if (!quiz || !quiz.disable_copy) return;

    const showAntiCheatToast = () => {
      setCopyWarning('Copying, text selection, and right-click are disabled during this assessment.');
      setTimeout(() => setCopyWarning(''), 3500);
    };

    const handleCopy = (e) => {
      e.preventDefault();
      showAntiCheatToast();
    };

    const handleCut = (e) => {
      e.preventDefault();
      showAntiCheatToast();
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      showAntiCheatToast();
    };

    const handleSelectStart = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
    };

    const handleDragStart = (e) => {
      e.preventDefault();
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, [quiz]);

  const handleSingleOptionChange = (questionId, option) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: option
    }));
  };

  const handleMultipleOptionToggle = (questionId, option) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      const currentList = Array.isArray(current) ? current : current.toString().split(',').filter(Boolean);
      let updated;
      if (currentList.includes(option)) {
        updated = currentList.filter(o => o !== option);
      } else {
        updated = [...currentList, option].sort();
      }
      return {
        ...prev,
        [questionId]: updated
      };
    });
  };

  const handleDescriptiveChange = (questionId, text) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: text
    }));
  };

  const countWords = (str) => {
    if (!str || typeof str !== 'string') return 0;
    const trimmed = str.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formattedAnswers = questions.map(q => {
      const ans = answers[q.id];
      let selectedOption = '';
      if (Array.isArray(ans)) {
        selectedOption = ans.sort().join(',');
      } else if (typeof ans === 'string') {
        selectedOption = ans.trim();
      }
      return {
        question_id: q.id,
        selected_option: selectedOption
      };
    });

    const unanswered = formattedAnswers.filter(a => !a.selected_option || !a.selected_option.trim());
    if (unanswered.length > 0) {
      const confirmed = await showConfirm({
        title: 'Unanswered Questions',
        message: `You have ${unanswered.length} unanswered question(s). Are you sure you want to submit?`,
        confirmText: 'Submit Anyway',
        cancelText: 'Keep Answering',
        isDanger: true
      });
      if (!confirmed) return;
    } else {
      const confirmed = await showConfirm({
        title: 'Submit Assessment',
        message: 'Are you ready to submit your answers? You cannot edit them after submitting.',
        confirmText: 'Submit Answers'
      });
      if (!confirmed) return;
    }

    setSubmitting(true);
    setError('');

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
        throw new Error(data.message || 'Submission failed.');
      }

      await showAlert({
        title: 'Submission Received',
        message: data.message,
        type: 'success'
      });

      navigate('/student/history');
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-state">
          <div className="spinner"></div>
          <span>Loading assessment...</span>
        </div>
      </div>
    );
  }

  if (error && !quiz) {
    return (
      <div className="container mt-30">
        <div className="alert alert-danger">{error}</div>
        <Link to="/student/dashboard" className="btn btn-secondary mt-10">&larr; Back to Dashboard</Link>
      </div>
    );
  }

  const answeredCount = questions.filter(q => {
    const a = answers[q.id];
    if (Array.isArray(a)) return a.length > 0;
    return Boolean(a && a.toString().trim());
  }).length;

  const progressPercent = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  return (
    <div className={`container ${quiz?.disable_copy ? 'anti-cheat-active' : ''}`}>
      {copyWarning && (
        <div className="anti-cheat-alert">
          <span className="shield-icon">🛡️</span>
          <span>{copyWarning}</span>
        </div>
      )}

      {/* Back button */}
      <div className="mb-15">
        <Link to="/student/dashboard" className="nav-back-link">
          &larr; Exit to Dashboard
        </Link>
      </div>

      {/* Quiz Info Banner */}
      <div className="quiz-header-card">
        <div className="quiz-header-main">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="section-badge">Live Assessment</span>
            {quiz?.disable_copy === 1 && (
              <span className="badge-anticheat">🛡️ Copy Protected</span>
            )}
            {quiz?.end_date && (
              <span className="badge-anticheat" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#7dd3fc', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                ⏳ Deadline: {new Date(quiz.end_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h1 className="quiz-banner-title">{quiz?.title}</h1>
          {quiz?.description && <p className="quiz-banner-desc">{quiz.description}</p>}
        </div>

        <div className="quiz-progress-box">
          <div className="progress-info-row">
            <span>Progress: <strong>{answeredCount} / {questions.length}</strong></span>
            <span>{progressPercent}%</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-20">{error}</div>}

      <form onSubmit={handleSubmit} className="quiz-attempt-form">
        {questions.map((q, idx) => {
          const qType = q.question_type || 'single';
          const ansVal = answers[q.id];
          const isAnswered = Array.isArray(ansVal) ? ansVal.length > 0 : Boolean(ansVal && ansVal.toString().trim());

          return (
            <div key={q.id} className="attempt-question-card">
              <div className="attempt-question-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="question-num-tag">Question {idx + 1}</span>
                  <span className="type-badge-pill">
                    {qType === 'multiple' ? 'Multiple Answers' : qType === 'descriptive' ? 'Descriptive' : 'Single Choice'}
                  </span>
                </div>
                <span className={`question-status-tag ${isAnswered ? 'tag-answered' : ''}`}>
                  {isAnswered ? '✓ Answered' : 'Pending'}
                </span>
              </div>

              {/* Prompt Text */}
              <p className="attempt-question-prompt">{q.question_text}</p>

              {/* Attached Image if available */}
              {q.image_url && (
                <div className="attempt-image-wrap mb-15">
                  <img src={q.image_url} alt={`Question ${idx + 1}`} className="attempt-image-display" />
                </div>
              )}

              {/* 1. Single Choice (Radio) */}
              {qType === 'single' && (
                <div className="attempt-options-list">
                  {(['A', 'B', 'C', 'D']).map((letter) => {
                    const optKey = `option_${letter.toLowerCase()}`;
                    const isSelected = ansVal === letter;
                    return (
                      <label
                        key={letter}
                        className={`attempt-option-item option-radio-card ${isSelected ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name={`question_${q.id}`}
                          value={letter}
                          checked={isSelected}
                          onChange={() => handleSingleOptionChange(q.id, letter)}
                          className="screen-reader-input"
                        />
                        <div className={`radio-visual-circle ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <div className="radio-inner-dot" />}
                        </div>
                        <div className="option-letter-chip">{letter}</div>
                        <div className="option-item-text">{q[optKey]}</div>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* 2. Multiple Answers (Clear Checkbox) */}
              {qType === 'multiple' && (
                <div>
                  <div className="multiple-select-banner">
                    <span className="multiple-banner-icon">☑</span>
                    <span><strong>Multiple Choice:</strong> Select all checkboxes that apply</span>
                  </div>
                  <div className="attempt-options-list">
                    {(['A', 'B', 'C', 'D']).map((letter) => {
                      const optKey = `option_${letter.toLowerCase()}`;
                      const selectedArray = Array.isArray(ansVal) ? ansVal : (ansVal ? ansVal.toString().split(',') : []);
                      const isSelected = selectedArray.includes(letter);
                      return (
                        <label
                          key={letter}
                          className={`attempt-option-item option-checkbox-card ${isSelected ? 'selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            name={`question_${q.id}_${letter}`}
                            value={letter}
                            checked={isSelected}
                            onChange={() => handleMultipleOptionToggle(q.id, letter)}
                            className="screen-reader-input"
                          />
                          <div className={`checkbox-visual-box ${isSelected ? 'checked' : ''}`}>
                            {isSelected && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>
                          <div className="option-letter-chip">{letter}</div>
                          <div className="option-item-text">{q[optKey]}</div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Descriptive (Textarea with Word Counter) */}
              {qType === 'descriptive' && (
                <div className="descriptive-answer-box">
                  <textarea
                    rows={5}
                    className="form-control descriptive-textarea"
                    placeholder="Type your response here..."
                    value={ansVal || ''}
                    onChange={(e) => handleDescriptiveChange(q.id, e.target.value)}
                  />
                  <div className="descriptive-meta-bar">
                    <span className="text-muted text-sm">
                      {q.word_limit ? `Limit: ${q.word_limit} words` : 'No word limit'}
                    </span>
                    <span className={`word-count-badge ${q.word_limit && countWords(ansVal) > q.word_limit ? 'text-danger font-bold' : ''}`}>
                      {countWords(ansVal)} {q.word_limit ? `/ ${q.word_limit}` : ''} words
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Floating Bottom Bar */}
        <div className="bottom-publish-bar">
          <div>
            <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> answered
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-glow"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
}
