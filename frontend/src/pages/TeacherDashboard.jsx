import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export default function TeacherDashboard() {
  const { user, token } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'past'

  const fetchQuizzes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/teacher`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to fetch quizzes.');
      }
      setQuizzes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleCloseQuiz = async (quizId, quizTitle) => {
    const confirmClose = window.confirm(
      `Are you sure you want to close "${quizTitle}"?\n\nOnce closed, no more students can attempt it, and students will immediately be able to view their scores!`
    );

    if (!confirmClose) return;

    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/${quizId}/close`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to close quiz.');
      }
      alert('Quiz closed successfully!');
      fetchQuizzes();
    } catch (err) {
      alert(err.message);
    }
  };

  const activeQuizzes = quizzes.filter(q => q.status === 'open');
  const pastQuizzes = quizzes.filter(q => q.status === 'closed');

  return (
    <div className="container">
      <div className="dashboard-header">
        <div>
          <h2>Teacher Dashboard</h2>
          <p className="subtitle">Welcome, Prof. {user?.name}! Manage your quizzes and student evaluations.</p>
        </div>
        <div>
          <Link to="/teacher/create-quiz" className="btn btn-primary">
            + Create New Quiz
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active / Open Quizzes ({activeQuizzes.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Past / Closed Quizzes ({pastQuizzes.length})
        </button>
      </div>

      {loading ? (
        <p className="text-center py-20">Loading your quizzes...</p>
      ) : activeTab === 'active' ? (
        <div>
          {activeQuizzes.length === 0 ? (
            <div className="card text-center py-30">
              <p>You have no active open quizzes.</p>
              <Link to="/teacher/create-quiz" className="btn btn-secondary mt-10">
                Create One Now
              </Link>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="quiz-table">
                <thead>
                  <tr>
                    <th>Quiz Title</th>
                    <th>Questions</th>
                    <th>Submissions</th>
                    <th>Status</th>
                    <th>Created On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeQuizzes.map((quiz) => (
                    <tr key={quiz.id}>
                      <td>
                        <strong>{quiz.title}</strong>
                        {quiz.description && <p className="quiz-desc-preview">{quiz.description}</p>}
                      </td>
                      <td>{quiz.total_questions}</td>
                      <td>{quiz.total_attempts} student(s)</td>
                      <td>
                        <span className="badge badge-success">OPEN</span>
                      </td>
                      <td>{new Date(quiz.created_at).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <Link
                          to={`/teacher/quiz/${quiz.id}/submissions`}
                          className="btn btn-secondary btn-sm"
                        >
                          View Scores ({quiz.total_attempts})
                        </Link>
                        <button
                          onClick={() => handleCloseQuiz(quiz.id, quiz.title)}
                          className="btn btn-danger btn-sm"
                        >
                          Close Quiz
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div>
          {pastQuizzes.length === 0 ? (
            <div className="card text-center py-30">
              <p>No past closed quizzes found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="quiz-table">
                <thead>
                  <tr>
                    <th>Quiz Title</th>
                    <th>Questions</th>
                    <th>Submissions</th>
                    <th>Status</th>
                    <th>Created On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pastQuizzes.map((quiz) => (
                    <tr key={quiz.id}>
                      <td>
                        <strong>{quiz.title}</strong>
                        {quiz.description && <p className="quiz-desc-preview">{quiz.description}</p>}
                      </td>
                      <td>{quiz.total_questions}</td>
                      <td>{quiz.total_attempts} student(s)</td>
                      <td>
                        <span className="badge badge-secondary">CLOSED</span>
                      </td>
                      <td>{new Date(quiz.created_at).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <Link
                          to={`/teacher/quiz/${quiz.id}/submissions`}
                          className="btn btn-secondary btn-sm"
                        >
                          View Student Scores
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
