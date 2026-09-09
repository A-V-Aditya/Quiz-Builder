import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export default function CreateQuiz() {
  const { token } = useAuth();
  const navigate = useNavigate();

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

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

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

  const removeQuestion = (index) => {
    if (questions.length === 1) {
      alert('A quiz must have at least one question.');
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Basic client validation
    if (!title.trim()) {
      setError('Please provide a quiz title.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim() || !q.option_a.trim() || !q.option_b.trim() || !q.option_c.trim() || !q.option_d.trim()) {
        setError(`Please fill all fields for Question #${i + 1}.`);
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

      alert('Quiz created successfully!');
      navigate('/teacher/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <h2>Create New Quiz</h2>
        <p className="subtitle">Add questions, four options for each, and mark the correct option.</p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Quiz General Details Card */}
        <div className="card mb-20">
          <h3>Quiz Details</h3>
          <div className="form-group">
            <label htmlFor="quizTitle">Quiz Title *</label>
            <input
              type="text"
              id="quizTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Database Management Systems - Unit 1"
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

        {/* Questions List */}
        <div className="questions-section">
          <h3>Questions ({questions.length})</h3>

          {questions.map((q, idx) => (
            <div key={idx} className="card question-card mb-20">
              <div className="question-header">
                <h4>Question #{idx + 1}</h4>
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

              <div className="form-group">
                <label>Question Text *</label>
                <input
                  type="text"
                  value={q.question_text}
                  onChange={(e) => handleQuestionChange(idx, 'question_text', e.target.value)}
                  placeholder="Enter your question here..."
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
