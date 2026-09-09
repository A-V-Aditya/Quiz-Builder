# Online Quiz Builder Application

A full-stack Quiz Builder application built with **React**, **Node.js + Express**, and **MySQL**, designed with a clean, minimal, and intuitive interface suitable for an academic MCA project.

---

## Features

### 1. Authentication & Roles
- **Registration**: Register as either a **Student** or **Teacher**.
- **Login**: Secure authentication using password hashing (`bcryptjs`) and JSON Web Tokens (`JWT`).

### 2. Teacher Features
- **Create Quizzes**: Add title, description, and dynamically add/remove multiple-choice questions (Option A, B, C, D) and select the correct option.
- **Active Quizzes Management**: View all open quizzes created by the teacher.
- **Close Quizzes**: Close any active quiz with a single click. Closing a quiz stops further attempts and automatically releases scores to students.
- **View Student Scores**: View a detailed evaluation table listing every student who attempted the quiz, their score, percentage, and submission timestamp.
- **Review Detailed Answers**: Inspect individual student answer sheets comparing selected choices against correct answers.
- **Past Quizzes**: Easily review historical closed quizzes and student performance.

### 3. Student Features
- **Available Quizzes**: Browse all active, open quizzes that have not yet been taken.
- **Take Quizzes**: Clean question-by-question form with radio button options and submission verification.
- **Score Protection**: Scores remain strictly hidden while a quiz is active/open to prevent leaks during tests.
- **Past Attempts & Score Release**: When the teacher closes the quiz, students can immediately view their final score, percentage, and click **View Solution** to inspect full explanations and answer keys.

---

## Database Schema (MySQL: `quiz_db`)

1. **`users`**: `id`, `name`, `email`, `password`, `role` (`student` | `teacher`), `created_at`
2. **`quizzes`**: `id`, `teacher_id`, `title`, `description`, `status` (`open` | `closed`), `created_at`
3. **`questions`**: `id`, `quiz_id`, `question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option` (`A` | `B` | `C` | `D`)
4. **`attempts`**: `id`, `quiz_id`, `student_id`, `score`, `total_questions`, `submitted_at`
5. **`attempt_answers`**: `id`, `attempt_id`, `question_id`, `selected_option`, `is_correct`

The complete schema script is available in `backend/schema.sql`.

---

## How to Run the Project Locally

### Prerequisites
- Node.js (v18+)
- MySQL Server / XAMPP running on port `3306` with default user `root` and no password (or configure in `backend/.env`).

### Step 1: Database Setup
Import the database schema into MySQL:
```bash
mysql -u root < backend/schema.sql
```

### Step 2: Start Backend Server
```bash
cd backend
npm install
npm start
```
The backend API will run on `http://localhost:5000`.

### Step 3: Start Frontend Client
```bash
cd frontend
npm install
npm run dev
```
The React frontend application will open on `http://localhost:5173`.

---

## Demo Accounts Created During Testing

- **Teacher Account**:
  - Email: `prof.alan@college.edu`
  - Password: `password123`
- **Student Account**:
  - Email: `rohan.student@college.edu`
  - Password: `password123`
