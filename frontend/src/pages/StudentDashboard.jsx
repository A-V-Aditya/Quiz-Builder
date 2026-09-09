import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

export default function StudentDashboard() {
  const { user, token } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAvailableQuizzes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/quizzes/available`, {
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
    fetchAvailableQuizzes();
  }, []);

  return (
    <div className="container">
      <div className="dashboard-header">
        <div>
          <h2>Student Portal - Available Quizzes</h2>
          <p className="subtitle">Welcome, {user?.name}! Here are the active quizzes ready for you to take.</p>
        </div>
        <div>
          <Link to="/student/history" className="btn btn-secondary">
            View My Past Attempts & Scores &rarr;
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <p className="text-center py-20">Loading available quizzes...</p>
      ) : quizzes.length === 0 ? (
        <div className="card text-center py-30">
          <h3>No Open Quizzes Available</h3>
          <p className="text-muted mt-10">
            There are currently no new open quizzes for you to attempt. 
            You may check your previous attempts and scores below.
          </p>
          <Link to="/student/history" className="btn btn-primary mt-20">
            Check Past Quizzes
          </Link>
        </div>
      ) : (
        <div className="quiz-cards-grid">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="card quiz-card">
              <div className="card-top">
                <span className="badge badge-success">ACTIVE</span>
                <span className="question-count">{quiz.total_questions} Questions</span>
              </div>
              <h3 className="quiz-title">{quiz.title}</h3>
              {quiz.description && <p className="quiz-description">{quiz.description}</p>}
              <div className="quiz-meta">
                <span>Instructor: <strong>{quiz.teacher_name}</strong></span>
                <span>Posted: {new Date(quiz.created_at).toLocaleDateString()}</span>
              </div>
              <div className="card-bottom mt-20">
                <Link to={`/student/quiz/${quiz.id}`} className="btn btn-primary btn-block">
                  Attempt Quiz Now &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
