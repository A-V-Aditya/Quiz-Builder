import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export default function CreateQuiz() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // General Quiz State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([
    {
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A'
    }
  ]);

  // AI Scanner State
  const [pdfFile, setPdfFile] = useState(null);
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('Medium');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState('');
  const [aiError, setAiError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // General Form State
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle manual question edits
  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  // Add a blank question
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'A'
      }
    ]);
  };

  // Remove a specific question
  const removeQuestion = (index) => {
    if (questions.length === 1) {
      alert('A quiz must have at least one question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  // Duplicate an existing question
  const duplicateQuestion = (index) => {
    const target = questions[index];
    const duplicated = { ...target };
    const updated = [...questions];
    updated.splice(index + 1, 0, duplicated);
    setQuestions(updated);
  };

  // Clear all questions
  const clearQuestions = () => {
    if (window.confirm('Are you sure you want to reset all questions?')) {
      setQuestions([
        {
          question_text: '',
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_option: 'A'
        }
      ]);
    }
  };

  // Handle PDF file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setAiError('Please select a valid PDF file (.pdf).');
        return;
      }
      setPdfFile(file);
      setAiError('');
      setAiSuccessMessage('');
    }
  };

  // Drag and drop handlers
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
        setAiError('Please select a valid PDF file (.pdf).');
        return;
      }
      setPdfFile(file);
      setAiError('');
      setAiSuccessMessage('');
    }
  };

  // Remove selected PDF
  const handleRemoveFile = () => {
    setPdfFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // AI PDF Generation Request
  const handleAiScan = async (e) => {
    e.preventDefault();
    if (!pdfFile) {
      setAiError('Please select or upload a PDF document first.');
      return;
    }

    setAiLoading(true);
    setAiError('');
    setAiSuccessMessage('');

    const formData = new FormData();
    formData.append('pdf', pdfFile);
    formData.append('numQuestions', numQuestions);
    formData.append('difficulty', difficulty);
    if (apiKey.trim()) {
      formData.append('apiKey', apiKey.trim());
    }

    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/generate-from-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const contentType = res.headers.get('content-type') || '';
      let data;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        console.error('Non-JSON response from server:', text);
        if (res.status === 404) {
          throw new Error('API route /api/quizzes/generate-from-pdf not found. Please ensure the backend server is running the latest code.');
        } else if (res.status >= 500) {
          throw new Error(`Backend server error (${res.status}). Please check backend console logs.`);
        } else {
          throw new Error(`Could not connect to backend API (HTTP ${res.status}). Please make sure backend is running on port 5000.`);
        }
      }

      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate questions from PDF.');
      }

      // Pre-fill Title & Description if currently empty
      if (!title.trim() && data.title) {
        setTitle(data.title);
      }
      if (!description.trim() && data.description) {
        setDescription(data.description);
      }

      // Check if current questions are just 1 empty default question
      const isDefaultBlank =
        questions.length === 1 &&
        !questions[0].question_text.trim() &&
        !questions[0].option_a.trim();

      if (isDefaultBlank) {
        setQuestions(data.questions);
      } else {
        const shouldAppend = window.confirm(
          `AI scanned "${pdfFile.name}" and generated ${data.questions.length} questions!\n\nClick "OK" to APPEND these to your existing questions, or "Cancel" to REPLACE your existing questions.`
        );
        if (shouldAppend) {
          setQuestions([...questions, ...data.questions]);
        } else {
          setQuestions(data.questions);
        }
      }

      const sourceLabel =
        data.source === 'gemini'
          ? 'Google Gemini AI'
          : data.source === 'openai'
            ? 'OpenAI'
            : 'Document Content Analysis';

      setAiSuccessMessage(
        `Success! Generated ${data.questions.length} questions using ${sourceLabel}. You can now review, refine, add, or remove questions below before publishing.`
      );
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Save Quiz to Database
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!title.trim()) {
      setError('Please provide a quiz title.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim() || !q.option_a.trim() || !q.option_b.trim() || !q.option_c.trim() || !q.option_d.trim()) {
        setError(`Please fill in all options for Question #${i + 1}.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
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
          questions
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create quiz.');
      }

      alert('Quiz created and published successfully!');
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
      <div className="page-header">
        <h2>Create New Quiz</h2>
        <p className="subtitle">
          Upload a PDF to automatically generate questions with AI, or manually build and customize your questions below.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* 1. AI PDF Scanner & Question Generator Card */}
      <div className="card ai-generator-card mb-20">
        <div className="ai-card-header">
          <div className="ai-title-wrap">
            <span style={{ fontSize: '1.4rem' }}>📄</span>
            <div>
              <h3 style={{ margin: 0, display: 'inline', marginRight: '8px' }}>
                Scan PDF & Generate Questions with AI
              </h3>
              <span className="ai-badge">AI Powered</span>
            </div>
          </div>
          <span className="text-sm text-muted">Upload lecture slides, notes, or chapters</span>
        </div>

        {aiError && <div className="alert alert-danger mb-10">{aiError}</div>}
        {aiSuccessMessage && <div className="alert alert-success mb-10">{aiSuccessMessage}</div>}

        {/* Drop Zone / File Picker */}
        {!pdfFile ? (
          <div
            className={`ai-drop-zone ${dragOver ? 'dragover' : ''}`}
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
            <span className="ai-drop-icon">📤</span>
            <div className="ai-drop-text">Click or drag & drop a PDF document here</div>
            <div className="ai-drop-subtext">Supports lecture notes, study materials, syllabi (up to 20MB)</div>
          </div>
        ) : (
          <div className="ai-file-preview">
            <div className="ai-file-info">
              <span style={{ fontSize: '1.5rem' }}>📑</span>
              <div>
                <div className="ai-file-name">{pdfFile.name}</div>
                <div className="ai-file-size">{(pdfFile.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="btn btn-secondary btn-sm"
              disabled={aiLoading}
            >
              Change PDF
            </button>
          </div>
        )}

        {/* Generation Options */}
        <div className="ai-controls-grid">
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="numQuestions">Number of Questions</label>
            <select
              id="numQuestions"
              value={numQuestions}
              onChange={(e) => setNumQuestions(Number(e.target.value))}
              className="select-input"
              disabled={aiLoading}
            >
              <option value={3}>3 Questions</option>
              <option value={5}>5 Questions</option>
              <option value={8}>8 Questions</option>
              <option value={10}>10 Questions</option>
              <option value={15}>15 Questions</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="difficulty">Difficulty Level</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="select-input"
              disabled={aiLoading}
            >
              <option value="Easy">Easy (Foundational & Definitions)</option>
              <option value="Medium">Medium (Conceptual & Application)</option>
              <option value="Hard">Hard (Analysis & Advanced)</option>
              <option value="Mixed">Mixed (Balanced Variety)</option>
            </select>
          </div>
        </div>

        {/* Optional Custom API Key accordion */}
        <div className="mb-10">
          <button
            type="button"
            className="toggle-link"
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          >
            {showApiKeyInput ? '▲ Hide Custom AI API Key' : '▼ Have your own Gemini / OpenAI API Key? (Optional)'}
          </button>
          {showApiKeyInput && (
            <div className="form-group mt-10">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste Gemini (AIzaSy...) or OpenAI (sk-...) API key"
                disabled={aiLoading}
              />
              <span className="text-sm text-muted">
                Leave blank to automatically use server defaults or the built-in document analysis fallback.
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          <button
            type="button"
            onClick={handleAiScan}
            disabled={!pdfFile || aiLoading}
            className="btn btn-ai-generate"
          >
            {aiLoading ? (
              <>
                <span className="spinner"></span>
                <span>Scanning PDF & Generating Questions...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Scan PDF & Generate Questions</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Quiz Creator Form */}
      <form onSubmit={handleSubmit}>
        {/* General Details Card */}
        <div className="card mb-20">
          <h3>Quiz Details</h3>
          <div className="form-group">
            <label htmlFor="quizTitle">Quiz Title *</label>
            <input
              type="text"
              id="quizTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Operating Systems - Virtual Memory & Page Replacement"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="quizDescription">Description (Optional)</label>
            <textarea
              id="quizDescription"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions or topic coverage..."
            />
          </div>
        </div>

        {/* Questions Section */}
        <div className="questions-section">
          <div className="questions-section-header">
            <div>
              <h3 style={{ display: 'inline' }}>Questions</h3>
              <span className="question-counter-badge">{questions.length} Question{questions.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={addQuestion}
                className="btn btn-secondary btn-sm"
              >
                + Add Question
              </button>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={clearQuestions}
                  className="btn btn-secondary btn-sm text-danger"
                >
                  Reset Questions
                </button>
              )}
            </div>
          </div>

          {questions.map((q, idx) => (
            <div key={idx} className="card question-card mb-20">
              <div className="question-header">
                <h4>Question #{idx + 1}</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => duplicateQuestion(idx)}
                    className="btn btn-secondary btn-sm"
                    title="Duplicate this question"
                  >
                    Duplicate
                  </button>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(idx)}
                      className="btn btn-danger btn-sm"
                    >
                      Remove Question
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label>Question Prompt / Text *</label>
                <input
                  type="text"
                  value={q.question_text}
                  onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                  placeholder="Enter your question prompt..."
                  required
                />
              </div>

              <div className="options-grid">
                <div className="form-group">
                  <label>Option A *</label>
                  <input
                    type="text"
                    value={q.option_a}
                    onChange={(e) => handleQuestionChange(idx, 'option_a', e.target.value)}
                    placeholder="Option A"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Option B *</label>
                  <input
                    type="text"
                    value={q.option_b}
                    onChange={(e) => handleQuestionChange(idx, 'option_b', e.target.value)}
                    placeholder="Option B"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Option C *</label>
                  <input
                    type="text"
                    value={q.option_c}
                    onChange={(e) => handleQuestionChange(idx, 'option_c', e.target.value)}
                    placeholder="Option C"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Option D *</label>
                  <input
                    type="text"
                    value={q.option_d}
                    onChange={(e) => handleQuestionChange(idx, 'option_d', e.target.value)}
                    placeholder="Option D"
                    required
                  />
                </div>
              </div>

              <div className="form-group correct-option-group">
                <label><strong>Correct Option *</strong></label>
                <select
                  value={q.correct_option}
                  onChange={(e) => handleQuestionChange(idx, 'correct_option', e.target.value)}
                  className="select-input"
                >
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  <option value="C">Option C</option>
                  <option value="D">Option D</option>
                </select>
              </div>
            </div>
          ))}

          <div className="form-actions mb-30">
            <button
              type="button"
              onClick={addQuestion}
              className="btn btn-secondary"
            >
              + Add Another Question
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Publishing...' : 'Save & Publish Quiz'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
