# Online Quiz Builder Application

A full-stack Quiz Builder application built with **React**, **Node.js + Express**, and **SQLite3**, designed with a clean, modern SaaS interface suitable for academic MCA projects.

---

## Features

### 1. Authentication & Roles
- **Registration & Login**: Secure role-based access for **Teachers** and **Students** using `bcryptjs` password hashing and JWT authentication.
- **Pre-seeded Accounts**: Demo teachers and 20 students ready to test out-of-the-box.

### 2. Teacher Features
- **✨ Dual Mode Quiz Creation**:
  - **Manual Builder**: Craft custom single-choice, multiple-choice, or descriptive questions with rich media attachments.
  - **AI-Powered Generator**: Upload lecture notes, textbook chapters, or syllabi in PDF format, or generate directly from custom topical prompts using Google Gemini AI with built-in heuristic NLP offline fallback.
  - **Configurable Question Limit**: Presets (3, 5, 8, 10, 15) or manual entry for 15+ questions.
- **Rich Question Types**:
  - **Single Choice**: Traditional radio options with randomized letter badges.
  - **Multiple Choice**: Distinct interactive checkboxes supporting multiple correct selections.
  - **Descriptive**: Text-based subjective responses with instructor word limits.
  - **Question Images**: Attach illustrative educational diagrams or image URLs directly to questions.
- **Academic Assessment Security**:
  - **Copy & Selection Protection**: Toggle anti-cheat mode to prevent text selection and copying.
  - **Quiz Expiration & Timers**: Set precise deadlines and end dates; automatically marks overdue quizzes closed.
  - **Flexible Results Policy**:
    1. *Wait until quiz ends* (`on_quiz_end`)
    2. *Immediate score & solutions* (`immediate_full`)
    3. *Immediate score only without answers* (`immediate_score_only`)
- **Comprehensive Analytics & Leaderboard**:
  - View overall score statistics (average score, pass rate, highest/lowest scores).
  - Score distribution histograms and visual progress bars.
  - Top 10 Student Leaderboard with ranks, scores, and completion times.
  - Question-by-question breakdown with accuracy rates and difficulty badges.
  - Inspect student submissions and full answer sheets.

### 3. Student Features
- **Available Quizzes**: Browse all currently open quizzes that have not yet been attempted.
- **Interactive Quiz Player**:
  - Clean question-by-question layout with clear square checkboxes for multi-select and circular radios for single-select.
  - Live progress meter tracking completed questions.
  - Word counter for descriptive answers.
- **Student History & Detailed Solutions**:
  - Review submitted quizzes, final scores, and percentages.
  - View full solutions and rubric reference answers when permitted by the instructor's results policy.

---

## Database (SQLite3: `quiz_db.sqlite`)

The application uses an embedded **SQLite3** database with foreign key enforcement (`PRAGMA foreign_keys = ON;`). Zero external database setup (e.g. MySQL or XAMPP) is needed.

### Schema Structure:
1. **`users`**: `id`, `name`, `email`, `password`, `role` (`student` | `teacher`), `created_at`
2. **`quizzes`**: `id`, `teacher_id`, `title`, `description`, `status` (`open` | `closed`), `disable_copy`, `end_date`, `results_policy`, `created_at`
3. **`questions`**: `id`, `quiz_id`, `question_text`, `question_type`, `image_url`, `word_limit`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option`, `created_at`
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
The backend API runs on `http://localhost:5000`.

#### Optional: Configuring Google Gemini AI API Key
In `backend/.env`, you can add your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If no API key is provided, the application will automatically use its built-in document analysis NLP generator, so quiz generation works 100% out-of-the-box offline!)*

---

### Step 2: Database Seeder & Cleanup Command

To reset the database, wipe old test data, and seed rich academic quizzes with massive student participation:

```bash
# Run from within the backend directory:
cd backend
npm run seed
```

Or from the project root directory:
```bash
npm --prefix backend run seed
```

#### What the Seeder Populates:
- **23 Users**: 3 Teachers and 20 Students (Password: `password123` for all).
- **6 Academic Quizzes (All owned by primary demo teacher `prof.alan@college.edu`)**:
  - **Active Quizzes (3)**:
    1. *Modern Web Engineering & React Fundamentals* (14 student attempts)
    2. *Database Systems & SQL Optimization* (13 student attempts)
    3. *Cybersecurity & Web Application Defense* (12 student attempts)
  - **Past / Closed Quizzes (3)**:
    4. *Data Structures & Algorithms Mastery* (17 student attempts)
    5. *Cloud Computing & Distributed Systems* (16 student attempts)
    6. *Operating Systems & Concurrency* (15 student attempts)
- **87 Total Student Attempts & 353 Evaluated Answers**: Provides populated analytics charts, bell-curve score distributions, and 10-student leaderboards for every quiz.

---

### Step 3: Start Frontend Client
```bash
cd frontend
npm install
npm run dev
```
The React frontend application opens on `http://localhost:5173`.

---

## Demo Accounts (Password for all: `password123`)

### 👨‍🏫 Primary Teacher Account
| Name | Email | Password | Role |
| :--- | :--- | :--- | :--- |
| **Prof. Alan Turing** | `prof.alan@college.edu` | `password123` | Teacher (Owns all 6 quizzes with 12–17 student submissions each) |

### 🎓 Demo Student Account
| Name | Email | Password | Role | Status in Seed Data |
| :--- | :--- | :--- | :--- | :--- |
| **Rohan Sharma** | `rohan.student@college.edu` | `password123` | Student | 2 past attempts in history (with full reviews); 3 active quizzes waiting on dashboard |

*(Additional students seeded: `priya.student@college.edu`, `aarav.student@college.edu`, `ananya.student@college.edu`, `vikram.student@college.edu`, `neha.student@college.edu`, `rahul.student@college.edu`, `sneha.student@college.edu`, `devansh.student@college.edu`, etc. with pass `password123`)*
