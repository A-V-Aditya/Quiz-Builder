import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePopup } from '../context/PopupContext';
import { API_BASE_URL } from '../config';

export default function CreateQuiz() {
  const { token } = useAuth();
  const { showConfirm, showAlert, showToast } = usePopup();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Top-level Mode: 'ai' or 'manual'
  const [creationMode, setCreationMode] = useState('ai');
  // AI Sub-mode: 'prompt' or 'pdf'
  const [aiSubMode, setAiSubMode] = useState('prompt');

  // General Quiz State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [disableCopy, setDisableCopy] = useState(true);
  const [endDate, setEndDate] = useState('');
  const [resultsPolicy, setResultsPolicy] = useState('on_quiz_end');

  // Questions State
  const [questions, setQuestions] = useState([
    {
      question_text: '',
      question_type: 'single', // 'single', 'multiple', 'descriptive'
      image_url: '',
      word_limit: 100,
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A'
    }
  ]);

  // AI Generator State
  const [topicPrompt, setTopicPrompt] = useState('');
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfPrompt, setPdfPrompt] = useState('');
  const [showPdfPrompt, setShowPdfPrompt] = useState(false);
  const [numQuestions, setNumQuestions] = useState(5);
  const [isCustomQuestions, setIsCustomQuestions] = useState(false);
  const [difficulty, setDifficulty] = useState('Medium');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');
  const [aiError, setAiError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Submit State
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleToggleMultipleCorrect = (index, letter) => {
    const current = questions[index].correct_option || '';
    const currentList = current.split(',').filter(Boolean);
    let newList;
    if (currentList.includes(letter)) {
      newList = currentList.filter(l => l !== letter);
    } else {
      newList = [...currentList, letter].sort();
    }
    handleQuestionChange(index, 'correct_option', newList.join(','));
  };

  const handleImageUpload = (index, e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showAlert({
          title: 'Invalid File',
          message: 'Please choose an image file (PNG, JPG, SVG, WebP).',
          type: 'danger'
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        handleQuestionChange(index, 'image_url', uploadEvent.target?.result || '');
        showToast('Image attached to question.', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const addQuestion = (type = 'single') => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        question_type: type,
        image_url: '',
        word_limit: 100,
        grading_mode: type === 'descriptive' ? 'manual' : null,
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: type === 'multiple' ? 'A' : type === 'single' ? 'A' : ''
      }
    ]);
  };

  const removeQuestion = (index) => {
    if (questions.length === 1) {
      showAlert({
        title: 'Action Restricted',
        message: 'A quiz must contain at least one question.',
        type: 'warning'
      });
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const duplicateQuestion = (index) => {
    const target = questions[index];
    const duplicated = { ...target };
    const updated = [...questions];
    updated.splice(index + 1, 0, duplicated);
    setQuestions(updated);
    showToast('Question cloned.', 'info');
  };

  const clearQuestions = async () => {
    const confirmed = await showConfirm({
      title: 'Reset Questions',
      message: 'Are you sure you want to discard current questions and reset?',
      confirmText: 'Reset',
      isDanger: true
    });
    if (confirmed) {
      setQuestions([
        {
          question_text: '',
          question_type: 'single',
          image_url: '',
          word_limit: 100,
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_option: 'A'
        }
      ]);
      showToast('Questions reset to default.', 'info');
    }
  };

  // PDF Dropzone handlers
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setAiError('Please select a valid PDF file.');
        return;
      }
      setPdfFile(file);
      setAiError('');
      setAiSuccessMessage('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setAiError('Please select a valid PDF file.');
        return;
      }
      setPdfFile(file);
      setAiError('');
      setAiSuccessMessage('');
    }
  };

  const handleRemoveFile = () => {
    setPdfFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // AI Generation (PDF or Prompt)
  const handleAiGenerate = async (e) => {
    e.preventDefault();
    setAiLoading(true);
    setAiError('');
    setAiSuccessMessage('');

    try {
      let res;
      if (aiSubMode === 'pdf') {
        if (!pdfFile) {
          throw new Error('Please select or drop a PDF document first.');
        }
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        formData.append('numQuestions', numQuestions || 5);
        formData.append('difficulty', difficulty);
        if (pdfPrompt.trim()) formData.append('prompt', pdfPrompt.trim());
        if (apiKey.trim()) formData.append('apiKey', apiKey.trim());

        res = await fetch(`${API_BASE_URL}/quizzes/generate-from-pdf`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
      } else {
        if (!topicPrompt.trim()) {
          throw new Error('Please enter a topic or concept prompt.');
        }
        res = await fetch(`${API_BASE_URL}/quizzes/generate-from-prompt`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            prompt: topicPrompt.trim(),
            numQuestions,
            difficulty,
            apiKey: apiKey.trim() || undefined
          })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate questions.');
      }

      if (!title.trim() && data.title) setTitle(data.title);
      if (!description.trim() && data.description) setDescription(data.description);

      const isDefaultBlank =
        questions.length === 1 &&
        !questions[0].question_text.trim() &&
        !questions[0].option_a.trim();

      if (isDefaultBlank) {
        setQuestions(data.questions);
      } else {
        const shouldAppend = await showConfirm({
          title: 'Questions Generated',
          message: `Generated ${data.questions.length} questions! Click "Append" to add them to your existing questions, or "Replace" to overwrite.`,
          confirmText: 'Append',
          cancelText: 'Replace'
        });
        if (shouldAppend) {
          setQuestions([...questions, ...data.questions]);
        } else {
          setQuestions(data.questions);
        }
      }

      showToast(`Generated ${data.questions.length} questions successfully!`, 'success');
      setCreationMode('manual');
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Submit Quiz
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Quiz title is required.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`Question #${i + 1} prompt statement is required.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (q.question_type === 'single' || q.question_type === 'multiple') {
        if (!q.option_a.trim() || !q.option_b.trim() || !q.option_c.trim() || !q.option_d.trim()) {
          setError(`Fill in all 4 options for Question #${i + 1}.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        if (!q.correct_option) {
          setError(`Designate correct option(s) for Question #${i + 1}.`);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
      }
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          disable_copy: disableCopy ? 1 : 0,
          end_date: endDate || null,
          results_policy: resultsPolicy,
          questions
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to publish quiz.');
      }

      showToast('Quiz published successfully!', 'success');
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

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
          <span className="section-badge">Authoring Studio</span>
          <h1 className="page-title">Create Assessment</h1>
          <p className="page-subtitle">Build questions manually or generate automatically with AI.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Creation Mode Switcher */}
      <div className="creation-mode-tabs">
        <button
          type="button"
          className={`mode-tab-btn ${creationMode === 'ai' ? 'active' : ''}`}
          onClick={() => setCreationMode('ai')}
        >
          <span className="mode-tab-icon">✨</span>
          <div>
            <strong>AI Powered Generator</strong>
            <span>Generate from PDF or direct prompt</span>
          </div>
        </button>

        <button
          type="button"
          className={`mode-tab-btn ${creationMode === 'manual' ? 'active' : ''}`}
          onClick={() => setCreationMode('manual')}
        >
          <span className="mode-tab-icon">✍️</span>
          <div>
            <strong>Manual Question Builder</strong>
            <span>Custom text, images, and question types</span>
          </div>
        </button>
      </div>

      {/* 1. AI Generator Section */}
      {creationMode === 'ai' && (
        <div className="ai-scanner-box mb-25">
          <div className="ai-box-head">
            <div className="ai-box-title">
              <div className="ai-icon-chip">✨</div>
              <div>
                <h3>AI Question Generator</h3>
                <p>Choose between PDF scan or topic prompt</p>
              </div>
            </div>
            {/* Sub-mode selector */}
            <div className="submode-pill-group">
              <button
                type="button"
                className={`submode-pill ${aiSubMode === 'prompt' ? 'active' : ''}`}
                onClick={() => setAiSubMode('prompt')}
              >
                💡 Topic Prompt
              </button>
              <button
                type="button"
                className={`submode-pill ${aiSubMode === 'pdf' ? 'active' : ''}`}
                onClick={() => setAiSubMode('pdf')}
              >
                📄 Upload PDF
              </button>
            </div>
          </div>

          {aiError && <div className="alert alert-danger mb-15">{aiError}</div>}
          {aiSuccessMessage && <div className="alert alert-success mb-15">{aiSuccessMessage}</div>}

          {/* Option A: Direct Topic Prompt */}
          {aiSubMode === 'prompt' ? (
            <div className="ai-prompt-input-wrap">
              <label className="input-field-label">Topic or Syllabus Prompt</label>
              <textarea
                rows={3}
                className="form-control"
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                placeholder="e.g. Distributed Databases, ACID properties, CAP Theorem, and Two-Phase Locking..."
                disabled={aiLoading}
              />
              <div className="prompt-suggestions">
                <span className="text-muted text-sm">Quick suggestions:</span>
                <button
                  type="button"
                  className="suggestion-tag"
                  onClick={() => setTopicPrompt('Operating Systems: Virtual Memory & Page Replacement Algorithms')}
                >
                  Operating Systems
                </button>
                <button
                  type="button"
                  className="suggestion-tag"
                  onClick={() => setTopicPrompt('Computer Networks: TCP/IP, Routing Protocols, and DNS')}
                >
                  Computer Networks
                </button>
                <button
                  type="button"
                  className="suggestion-tag"
                  onClick={() => setTopicPrompt('Full-Stack React & Node.js REST API Best Practices')}
                >
                  Web Development
                </button>
              </div>
            </div>
          ) : (
            /* Option B: PDF Dropzone */
            <div>
              {!pdfFile ? (
                <div
                  className={`dropzone ${dragOver ? 'dropzone-active' : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,application/pdf"
                    style={{ display: 'none' }}
                  />
                  <div className="dropzone-icon">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                  </div>
                  <div className="dropzone-title">Click or drop study material PDF</div>
                  <div className="dropzone-hint">Lecture notes, syllabus, or textbooks (Max 20MB)</div>
                </div>
              ) : (
                <div className="file-chip-card">
                  <div className="file-chip-info">
                    <div className="file-chip-icon">📄</div>
                    <div>
                      <div className="file-chip-name">{pdfFile.name}</div>
                      <div className="file-chip-size">{(pdfFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="btn btn-sm btn-secondary"
                    disabled={aiLoading}
                  >
                    Replace
                  </button>
                </div>
              )}

              {/* Optional Prompt Toggle for PDF */}
              <div className="pdf-prompt-toggle-wrap mt-10">
                <button
                  type="button"
                  className="text-toggle-btn"
                  onClick={() => setShowPdfPrompt(!showPdfPrompt)}
                >
                  {showPdfPrompt ? '▲ Hide Focus Instructions (Optional)' : '▼ Add Focus Instructions / Prompt (Optional)'}
                </button>
                {showPdfPrompt && (
                  <div className="mt-8">
                    <textarea
                      rows={2}
                      className="form-control"
                      value={pdfPrompt}
                      onChange={(e) => setPdfPrompt(e.target.value)}
                      placeholder="e.g. Focus on Chapter 3 memory management, prioritize practical application questions, exclude historical trivia..."
                      disabled={aiLoading}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Generator Controls */}
          <div className="ai-options-row">
            <div className="form-group-compact">
              <label htmlFor="numQuestions">Questions</label>
              <select
                id="numQuestions"
                value={isCustomQuestions ? 'custom' : numQuestions}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setIsCustomQuestions(true);
                    if (numQuestions <= 15) setNumQuestions(20);
                  } else {
                    setIsCustomQuestions(false);
                    setNumQuestions(Number(e.target.value));
                  }
                }}
                className="form-control"
                disabled={aiLoading}
              >
                <option value={3}>3 Questions</option>
                <option value={5}>5 Questions</option>
                <option value={8}>8 Questions</option>
                <option value={10}>10 Questions</option>
                <option value={15}>15 Questions</option>
                <option value="custom">More... (Custom number)</option>
              </select>

              {isCustomQuestions && (
                <div className="mt-8 input-with-addon">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={numQuestions}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setNumQuestions(isNaN(val) ? '' : Math.max(1, Math.min(50, val)));
                    }}
                    className="form-control"
                    placeholder="e.g. 20"
                    disabled={aiLoading}
                  />
                  <span className="addon-text">Questions</span>
                </div>
              )}
            </div>

            <div className="form-group-compact">
              <label htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="form-control"
                disabled={aiLoading}
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
          </div>

          <div className="api-key-toggle-wrap">
            <button
              type="button"
              className="text-toggle-btn"
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            >
              {showApiKeyInput ? '▲ Hide Custom API Key' : '▼ Custom Gemini API Key (Optional)'}
            </button>
            {showApiKeyInput && (
              <input
                type="password"
                className="form-control mt-10"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste Gemini API key..."
                disabled={aiLoading}
              />
            )}
          </div>

          <div className="mt-15">
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={aiLoading || (aiSubMode === 'pdf' && !pdfFile) || (aiSubMode === 'prompt' && !topicPrompt.trim())}
              className="btn btn-primary btn-block"
            >
              {aiLoading ? (
                <>
                  <span className="spinner"></span>
                  <span>Generating Questions...</span>
                </>
              ) : (
                <>
                  <span>Generate Questions</span>
                  <span className="badge-sparkle">AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Form & Questions Editor */}
      <form onSubmit={handleSubmit}>
        {/* Settings Panel */}
        <div className="panel-card mb-20">
          <h3 className="panel-title">Assessment Settings</h3>
          <div className="form-group">
            <label htmlFor="quizTitle">Title *</label>
            <input
              type="text"
              id="quizTitle"
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Database Management Systems — Quiz 1"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="quizDescription">Description</label>
            <textarea
              id="quizDescription"
              rows={2}
              className="form-control"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions or topic summary..."
            />
          </div>

          {/* New: Deadline and Results Release Policy */}
          <div className="quiz-config-2col mb-15">
            <div className="form-group mb-0">
              <label htmlFor="quizEndDate">Deadline / End Date (Optional)</label>
              <input
                type="datetime-local"
                id="quizEndDate"
                className="form-control"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <span className="text-muted text-sm mt-4" style={{ display: 'block' }}>
                Leave blank for manual close anytime.
              </span>
            </div>

            <div className="form-group mb-0">
              <label htmlFor="resultsPolicy">Score & Solutions Release</label>
              <select
                id="resultsPolicy"
                className="form-control"
                value={resultsPolicy}
                onChange={(e) => setResultsPolicy(e.target.value)}
              >
                <option value="on_quiz_end">🔒 Hold Until Quiz Ends (Recommended for exams)</option>
                <option value="immediate_score_only">📊 Instant Score Only (Keys hidden until quiz ends)</option>
                <option value="immediate_full">⚡ Instant Full Results (Score & solutions shown immediately)</option>
              </select>
            </div>
          </div>

          {/* Anti-cheat Option */}
          <div className="anticheat-box">
            <label className="checkbox-toggle-label">
              <input
                type="checkbox"
                checked={disableCopy}
                onChange={(e) => setDisableCopy(e.target.checked)}
              />
              <div>
                <strong>Disable Copy / Text Selection (Anti-Cheat)</strong>
                <span>Prevents students from copying prompts, dragging text, and opening right-click menus during tests.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Questions Header */}
        <div className="questions-header-bar">
          <div>
            <h2 className="section-title">Questions</h2>
            <span className="section-count">{questions.length} total</span>
          </div>
          <div className="btn-group">
            <div className="add-question-menu">
              <button
                type="button"
                onClick={() => addQuestion('single')}
                className="btn btn-sm btn-secondary"
              >
                + Single Choice
              </button>
              <button
                type="button"
                onClick={() => addQuestion('multiple')}
                className="btn btn-sm btn-secondary"
              >
                + Multiple Answers
              </button>
              <button
                type="button"
                onClick={() => addQuestion('descriptive')}
                className="btn btn-sm btn-secondary"
              >
                + Descriptive
              </button>
            </div>
            {questions.length > 1 && (
              <button
                type="button"
                onClick={clearQuestions}
                className="btn btn-sm btn-danger-soft"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Questions List */}
        {questions.map((q, idx) => (
          <div key={idx} className="question-edit-card">
            <div className="question-card-header">
              <div className="q-head-left">
                <span className="question-idx-badge">#{idx + 1}</span>
                <select
                  value={q.question_type || 'single'}
                  onChange={(e) => {
                    const newType = e.target.value;
                    handleQuestionChange(idx, 'question_type', newType);
                    if (newType === 'multiple' && !q.correct_option) {
                      handleQuestionChange(idx, 'correct_option', 'A');
                    } else if (newType === 'single') {
                      handleQuestionChange(idx, 'correct_option', 'A');
                    }
                  }}
                  className="type-select-dropdown"
                >
                  <option value="single">Single Choice (Radio)</option>
                  <option value="multiple">Multiple Answers (Checkboxes)</option>
                  <option value="descriptive">Descriptive (Text Answer)</option>
                </select>
              </div>

              <div className="question-action-btns">
                <button
                  type="button"
                  onClick={() => duplicateQuestion(idx)}
                  className="btn-icon"
                  title="Clone Question"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="btn-icon btn-icon-danger"
                    title="Delete Question"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Prompt */}
            <div className="form-group">
              <label>Question Prompt *</label>
              <textarea
                rows={2}
                className="form-control"
                value={q.question_text}
                onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                placeholder="Question statement..."
                required
              />
            </div>

            {/* Optional Image Upload / URL */}
            <div className="image-attachment-section">
              {!q.image_url ? (
                <div className="image-upload-trigger">
                  <label className="btn-upload-image">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                    <span>+ Add Image to Question</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(idx, e)}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <span className="text-muted text-sm">or</span>
                  <input
                    type="text"
                    className="form-control form-control-sm img-url-input"
                    placeholder="Paste image URL (https://...)"
                    value={q.image_url || ''}
                    onChange={(e) => handleQuestionChange(idx, 'image_url', e.target.value)}
                  />
                </div>
              ) : (
                <div className="image-preview-box">
                  <img src={q.image_url} alt={`Question ${idx + 1}`} className="img-thumbnail" />
                  <div className="image-preview-actions">
                    <span className="text-sm">Attached Image</span>
                    <button
                      type="button"
                      onClick={() => handleQuestionChange(idx, 'image_url', '')}
                      className="btn btn-sm btn-danger-soft"
                    >
                      Remove Image
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mode-specific question fields */}
            {q.question_type === 'descriptive' ? (
              <div className="descriptive-config-box">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                  <div className="form-group-compact">
                    <label htmlFor={`wordlimit_${idx}`}>Word / Character Limit</label>
                    <div className="input-with-addon">
                      <input
                        type="number"
                        id={`wordlimit_${idx}`}
                        className="form-control"
                        value={q.word_limit || 100}
                        onChange={(e) => handleQuestionChange(idx, 'word_limit', parseInt(e.target.value, 10) || 0)}
                        min={10}
                        max={1000}
                      />
                      <span className="addon-text">Words max</span>
                    </div>
                  </div>

                  <div className="form-group-compact">
                    <label htmlFor={`gradingmode_${idx}`}>Grading / Evaluation Method</label>
                    <select
                      id={`gradingmode_${idx}`}
                      className="form-control"
                      value={q.grading_mode || 'manual'}
                      onChange={(e) => handleQuestionChange(idx, 'grading_mode', e.target.value)}
                    >
                      <option value="manual">👨‍🏫 Teacher Manual Review (Default full mark, editable in sheet)</option>
                      <option value="ai">🤖 AI Semantic Evaluation (Background Gemini AI grading)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group mt-12">
                  <label>Sample Answer / Evaluation Rubric (Optional)</label>
                  <textarea
                    rows={2}
                    className="form-control"
                    value={q.correct_option || ''}
                    onChange={(e) => handleQuestionChange(idx, 'correct_option', e.target.value)}
                    placeholder="Key concepts or reference answer for review..."
                  />
                </div>
              </div>
            ) : (
              /* Single Choice or Multiple Choice Options Grid */
              <div>
                <div className="options-2x2-grid">
                  {(['a', 'b', 'c', 'd']).map((optKey) => {
                    const upper = optKey.toUpperCase();
                    const isMultiple = q.question_type === 'multiple';
                    const currentSelectedList = (q.correct_option || '').split(',').map(s => s.trim().toUpperCase());
                    const isCorrect = isMultiple
                      ? currentSelectedList.includes(upper)
                      : q.correct_option === upper;

                    return (
                      <div key={optKey} className={`option-edit-field ${isCorrect ? 'option-marked-correct' : ''}`}>
                        <button
                          type="button"
                          className={`option-badge-btn ${isCorrect ? 'badge-correct' : ''}`}
                          onClick={() => {
                            if (isMultiple) {
                              handleToggleMultipleCorrect(idx, upper);
                            } else {
                              handleQuestionChange(idx, 'correct_option', upper);
                            }
                          }}
                          title={`Click to toggle Option ${upper} as correct`}
                        >
                          {isMultiple ? (isCorrect ? `☑ ${upper}` : `☐ ${upper}`) : `${upper} ${isCorrect ? '✓' : ''}`}
                        </button>
                        <input
                          type="text"
                          className="form-control option-input"
                          value={q[`option_${optKey}`]}
                          onChange={(e) => handleQuestionChange(idx, `option_${optKey}`, e.target.value)}
                          placeholder={`Option ${upper}`}
                          required
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="correct-answer-indicator">
                  <span>Correct Key:</span>
                  <strong className="text-primary">
                    {q.question_type === 'multiple'
                      ? (q.correct_option ? `Option(s) ${q.correct_option}` : 'None selected (click badges)')
                      : `Option ${q.correct_option}`}
                  </strong>
                  <span className="text-muted">
                    {q.question_type === 'multiple'
                      ? '(Check multiple badges as needed)'
                      : '(Click badge to set correct)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Bottom Bar */}
        <div className="bottom-publish-bar">
          <div className="btn-group">
            <button
              type="button"
              onClick={() => addQuestion('single')}
              className="btn btn-secondary"
            >
              + Single Choice
            </button>
            <button
              type="button"
              onClick={() => addQuestion('multiple')}
              className="btn btn-secondary"
            >
              + Multiple Answers
            </button>
            <button
              type="button"
              onClick={() => addQuestion('descriptive')}
              className="btn btn-secondary"
            >
              + Descriptive
            </button>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-glow"
            disabled={loading}
          >
            {loading ? 'Publishing...' : 'Publish Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
}
