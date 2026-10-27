# Online Quiz Builder Application

A full-stack Quiz Builder application built with **React**, **Node.js + Express**, and **SQLite3**, designed with a clean, minimal, and intuitive interface suitable for an academic MCA project.

---

## Features

### 1. Authentication & Roles
- **Registration**: Register as either a **Student** or **Teacher**.
- **Login**: Secure authentication using password hashing (`bcryptjs`) and JSON Web Tokens (`JWT`).

### 2. Teacher Features
- **✨ AI PDF Quiz Scanner & Generator**:
  - Upload any study material, lecture notes, textbook chapters, or syllabi in PDF format (drag & drop or file picker up to 20MB).
  - Automatically parses PDF text (`pdf-parse`) and generates high-quality Multiple Choice Questions (MCQs) using Google Gemini AI (`@google/genai`) or OpenAI.
  - Built-in heuristic NLP document analysis fallback so quiz generation works seamlessly even without an AI API key configured.
  - Customizable number of questions (3, 5, 8, 10, 15) and difficulty level (Easy, Medium, Hard, Mixed).
- **Interactive Question Editing & Management**:
  - Full control over AI-generated questions: review, edit question prompts, adjust options (A, B, C, D), and modify the correct answer key.
  - **Add More Questions**: Add custom questions alongside AI questions with "+ Add Question".
  - **Remove Questions**: Discard any unwanted questions with a single click.
  - **Duplicate & Reset**: Clone questions or reset questions as needed.
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

## Database (SQLite3: `quiz_db.sqlite`)

The application uses an embedded **SQLite3** database with foreign key enforcement (`PRAGMA foreign_keys = ON;`). Zero external database installation or setup (e.g., MySQL or XAMPP) is needed; the database file and tables are automatically initialized on server startup.

### Schema Structure:
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

*(No separate MySQL server or database service required!)*

### Step 1: Start Backend Server
```bash
cd backend
npm install
npm start
```
The backend API will run on `http://localhost:5000`. On first run, it automatically creates and initializes `quiz_db.sqlite` with seed demo accounts and sample quizzes.

#### Optional: Configuring Google Gemini AI API Key
In `backend/.env`, you can add your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If no API key is provided, the application will automatically use its built-in document analysis NLP generator, so the system works 100% out-of-the-box offline or without an API key! Teachers can also provide an optional API key directly in the web UI).*

### Step 2: Start Frontend Client
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
