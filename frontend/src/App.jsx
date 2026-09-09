import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import TeacherDashboard from './pages/TeacherDashboard';
import CreateQuiz from './pages/CreateQuiz';
import QuizSubmissions from './pages/QuizSubmissions';
import StudentDashboard from './pages/StudentDashboard';
import AttemptQuiz from './pages/AttemptQuiz';
import StudentHistory from './pages/StudentHistory';
import './App.css';

// Root redirector component
function RootRedirect() {
  const { user, token, loading } = useAuth();

  if (loading) {
    return <div className="container text-center py-30">Loading...</div>;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'teacher') {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  return <Navigate to="/student/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <main>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Teacher routes */}
            <Route
              path="/teacher/dashboard"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/create-quiz"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <CreateQuiz />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/quiz/:id/submissions"
              element={
                <ProtectedRoute allowedRole="teacher">
                  <QuizSubmissions />
                </ProtectedRoute>
              }
            />

            {/* Student routes */}
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowedRole="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/quiz/:id"
              element={
                <ProtectedRoute allowedRole="student">
                  <AttemptQuiz />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/history"
              element={
                <ProtectedRoute allowedRole="student">
                  <StudentHistory />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}
