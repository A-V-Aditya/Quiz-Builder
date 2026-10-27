# Project Architecture & Post-Commit Changes Overview

This document provides a simple, easy-to-understand summary of the **Quiz Builder** project architecture (Frontend & Backend) and explains all the new features and improvements added after the last Git commit (`feat: add AI PDF quiz generator with interactive question editing`).

---

## 1. Quick Summary (What Changed?)

In short, the application was transformed from a basic prototype into a **polished, modern academic assessment platform**:
- 🎨 **Redesigned UI**: Implemented a sleek, light & dark blue SaaS aesthetic with clean cards, glassmorphism banners, and responsive layouts.
- 🚫 **No Native Browser Alerts**: Replaced all native browser `alert()` and `confirm()` dialogs with custom animated popup modals and toast alerts.
- 📝 **Dual-Mode Quiz Creation**: Teachers can choose between a **Manual Builder** or an **AI-Powered Generator** (via PDF upload or direct syllabus prompt).
- ☑️ **Multiple-Choice Checkboxes**: Multi-select questions now feature clear, interactive square checkboxes (`☑` / `☐`) with checkmarks.
- 📄 **Descriptive Questions & Dual Grading Modes**:
  - **AI Semantic Evaluation**: Evaluated asynchronously in the background via Google Gemini AI / semantic engine without causing student submission lag.
  - **Teacher Manual Grading**: Full mark awarded by default on submission; teachers can adjust marks (`✓ Full Mark` / `✕ 0 Marks`) directly from the "Inspect Sheet" modal.
- 🛡️ **Anti-Cheat Protection**: Optional copy & text selection disable mode during assessments.
- 📊 **Visual Analytics & Full Leaderboard**: Interactive score distribution graphs, question difficulty ratings, and rankings for **all** participating students.
- 🔍 **Inspect Answer Sheets from Leaderboard**: Teachers can click a single button on any student in the leaderboard to view their exact response sheet and adjust descriptive marks.
- 🧹 **Clean Database & Enterprise Seeder**: Wiped leftover test quizzes and created a one-command seeder (`npm run seed`) with 20 students, 6 quizzes, and 87 evaluated submissions.
- ⬅️ **Unified Navigation**: Added clean back-navigation arrows on every screen.

---

## 2. High-Level Architecture

```
[ Frontend: React + Vite ] (Port 5173)
       │
       │  REST API Calls (JSON Web Tokens)
       ▼
[ Backend: Node.js + Express ] (Port 5000)
       │
       │  SQL Queries (Native Driver)
       ▼
[ Database: SQLite3 (`quiz_db.sqlite`) ]
```

- **Frontend**: Single-page application built with React, React Router v6, and modern CSS. Zero heavy UI libraries—everything is custom-crafted, lightweight, and fast.
- **Backend**: Express REST API with JWT authentication and bcrypt password hashing.
- **Database**: Zero-configuration embedded SQLite (`quiz_db.sqlite`) with foreign key constraints.

---

## 3. Backend Changes (Detailed)

### A. Database Migrations & New Schema Columns (`backend/schema.sql`, `backend/config/db.js`)
- **`quizzes` table**:
  - `disable_copy` (INTEGER): `1` if copy-paste and text selection are disabled; `0` otherwise.
  - `end_date` (TEXT): ISO timestamp for quiz deadlines.
  - `results_policy` (TEXT): Controls when students can see answers (`on_quiz_end`, `immediate_full`, `immediate_score_only`).
- **`questions` table**:
  - `question_type` (TEXT): `'single'`, `'multiple'`, or `'descriptive'`.
  - `grading_mode` (TEXT): `'manual'` (teacher manual review) or `'ai'` (Gemini AI semantic evaluation).
  - `image_url` (TEXT): Attached diagram or figure URL.
  - `word_limit` (INTEGER): Maximum word limit for descriptive questions.
  - Flexible answer keys: Relaxed single-character CHECK constraints so multi-answer keys (e.g. `'A,C'`) and descriptive rubrics store cleanly.
- **`attempt_answers` table**:
  - `feedback` (TEXT): AI assessment summary or instructor evaluation note.
  - `graded_by` (TEXT): Identifies grading source (`'auto'`, `'ai'`, or `'teacher'`).
  - Relaxed restrictions to allow comma-separated options and written text responses.

### B. Route Enhancements (`backend/routes/quizzes.js`, `backend/routes/attempts.js`)
1. **Zero-Lag Attempt Submission & Asynchronous AI Evaluation**:
   - **Single Choice**: Compares selected single letter against the key.
   - **Multiple Choice**: Automatically normalizes and sorts selected options (e.g. `A,C`) against the correct options.
   - **Descriptive Questions**:
     - *Manual mode*: Awards full mark by default if non-empty; teacher can edit anytime.
     - *AI mode*: Returns an immediate HTTP 201 response so the student experiences **zero waiting lag**. Asynchronously evaluates conceptual depth using Google Gemini AI in the background, updating scores and recording constructive feedback.
2. **Teacher Manual Grading Endpoint (`PATCH /api/attempts/grade-answer`)**:
   - Allows instructors to adjust marks (`is_correct: 1` or `0`) and add feedback notes on student response sheets.
   - Automatically recalculates the attempt score and updates the leaderboard in real time.
3. **Full-Spectrum Analytics Endpoint (`GET /api/quizzes/:id/analytics`)**:
   - Calculates total submissions, average score, highest/lowest scores, and pass rate.
   - Groups scores into 4 distribution brackets (`0-25%`, `26-50%`, `51-75%`, `76-100%`).
   - Analyzes accuracy per question to assign difficulty labels (`Easy`, `Moderate`, `Hard`).
   - Returns **all** student attempts sorted by score and time with their `attempt_id` (not capped at 10).
4. **Quiz Expiration & Close Controls**:
   - `PATCH /api/quizzes/:id/close`: Manually closes a quiz and immediately releases results according to the policy.
   - Quizzes past their `end_date` are automatically treated as expired.

### C. Seeder Script (`backend/seed.js`)
- Runs with `npm run seed` inside `backend/`.
- Cleans old test data and resets auto-increment primary keys.
- Seeds 3 teachers (Prof. Alan Turing, Dr. Ada Lovelace, Prof. Grace Hopper).
- Seeds 20 realistic student accounts (`rohan`, `priya`, `aarav`, `ananya`, etc.).
- Seeds 6 academic quizzes (3 active, 3 closed) all owned by Prof. Alan Turing.
- Generates 87 realistic submissions and 353 answers with realistic score distributions.

---

## 4. Frontend Changes (Detailed)

### A. Custom Modal & Toast System (`frontend/src/context/PopupContext.jsx`)
- Created a React Context provider for smooth, non-blocking UI popups:
  - `showConfirm({ title, message, confirmText, isDanger })`: Custom confirmation dialog for closing quizzes or resetting forms.
  - `showAlert({ title, message, type })`: Warning/Info alert modal.
  - `showToast(message, type)`: Non-intrusive floating toasts that auto-dismiss in 3 seconds.
- Removed every single `window.alert()` and `window.confirm()` from the codebase.

### B. Authoring Studio & Dual-Mode Creation (`frontend/src/pages/CreateQuiz.jsx`)
- **Mode 1: AI-Powered Generator**:
  - Sub-mode A: Direct topic or syllabus prompt with quick suggestion tags.
  - Sub-mode B: PDF file dropzone with an optional focus prompt toggle.
  - Question count dropdown: Presets for 3, 5, 8, 10, 15, or manual input for 15+ up to 50 questions.
  - Difficulty selector: Easy, Medium, Hard, Mixed.
  - Optional Gemini API Key input.
  - **Themed Dark Blue Inputs**: Form fields inside the AI card feature a semi-transparent dark-blue glass finish (`rgba(10, 25, 47, 0.6)`), cyan borders, and glowing active states matching the card gradient.
- **Mode 2: Manual Builder**:
  - Add, duplicate, reorder, or delete questions.
  - Switch each question between Single Choice, Multiple Choice, and Descriptive.
  - For Descriptive: Select between **👨‍🏫 Teacher Manual Review** and **🤖 AI Semantic Evaluation**.
  - Attach image URLs with live previews.
  - Set word limits for descriptive answers.
- **Assessment Settings Panel**:
  - Anti-cheat copy protection toggle.
  - Optional deadline datetime picker.
  - Results release policy selector.

### C. Interactive Student Quiz Interface (`frontend/src/pages/AttemptQuiz.jsx`)
- **Multiple-Choice Checkboxes**:
  - Square checkbox (`.checkbox-visual-box`) with SVG checkmarks.
  - Blue guidance banner reminding students to select all applicable options.
  - Multi-select state handling (toggle options in/out of the answer array).
- **Single-Choice Radio Buttons**:
  - Distinct circular indicator (`.radio-visual-circle`) with inner dot.
- **Descriptive Questions**:
  - Form textarea with live word count indicator (shows green/red if within word limit).
- **Anti-Cheat Protection**:
  - When enabled, blocks right-click context menu, text selection, and copy shortcuts with a shield warning banner.
- **Back Navigation**:
  - Added `← Exit to Dashboard` at the top.

### D. Analytics & Performance Intelligence (`frontend/src/pages/QuizAnalytics.jsx`)
- **Header & Navigation**:
  - Added `← Back to Dashboard` navigation link at the top.
- **4 Key Stat Cards**: Total Submissions, Average Score, Pass Rate, and Top Score.
- **Score Distribution Histogram**: Visual bar tracks for `0-25%`, `26-50%`, `51-75%`, and `76-100%`.
- **Question Accuracy Breakdown**: Accuracy bar for each question with `Easy` / `Moderate` / `Hard` tags.
- **Uncapped Student Leaderboard**:
  - Shows **all** students who attempted the quiz with medal badges (🥇 1st, 2nd, 3rd).
  - Displays Student Name, Avatar, Email, Score, Percentage, and Submission Time.
  - **"📄 Inspect Sheet" Action Button**: Opens a full answer sheet modal showing that student's selections, correct answers, and written responses.
  - **Live Mark Adjustments**: Includes `[✓ Full Mark (1 Pt)]` and `[✕ 0 Marks]` buttons to immediately alter descriptive question scores.

### E. Clean Submissions Management (`frontend/src/pages/QuizSubmissions.jsx`)
- Removed the redundant `Average Score` card to keep this page focused on student submissions.
- Added `← Back to Dashboard` link at the top.
- Features the same detailed modal review with live mark adjustment buttons.

### F. Teacher Dashboard (`frontend/src/pages/TeacherDashboard.jsx`)
- **Sleek Action Buttons**:
  - Replaced bulky buttons with compact `.btn-card-action` buttons (`5px 9px` padding, `0.76rem` typography).
  - Clean layout: **📊 Analytics**, **Results**, and **Stop** fit side-by-side without crowding or wrapping.
- **Active vs. Closed Tabs**:
  - Tab 1: Active Quizzes (shows live countdown and submission count).
  - Tab 2: Closed Quizzes (shows final evaluated counts).

### G. Student History (`frontend/src/pages/StudentHistory.jsx`)
- Added `← Back to Dashboard` navigation link.
- Shows submitted quizzes, scores, and dates.
- Interactive solution review displays checkboxes (`☑` / `☐`), correct keys, teacher rubrics, and AI/instructor feedback notes.

### H. Styling Overhaul (`frontend/src/App.css`)
- Light & dark blue gradient color scheme (`--grad-primary`, `--grad-card-soft`, `--color-blue-primary`).
- Custom styles for `.checkbox-visual-box`, `.radio-visual-circle`, `.btn-card-action`, `.nav-back-link`, `.teacher-grade-bar`, and `.btn-grade-toggle`.

---

## 5. File Change Summary

| File | Type | Changes Made |
| :--- | :--- | :--- |
| **`backend/schema.sql`** | Database | Added `disable_copy`, `end_date`, `results_policy`, `question_type`, `grading_mode`, `image_url`, `word_limit`, `feedback`, `graded_by`. |
| **`backend/config/db.js`** | Backend | Auto-migration routines for tables, seed fallback logic. |
| **`backend/routes/quizzes.js`** | Backend | Analytics calculation, uncapped leaderboard with attempt IDs, deadline checks. |
| **`backend/routes/attempts.js`** | Backend | Multi-select evaluation, non-blocking submission, async AI grading, teacher mark adjustments. |
| **`backend/services/aiService.js`**| Backend | Added `evaluateDescriptiveAnswer` for automated Gemini semantic evaluation. |
| **`backend/seed.js`** | Script | Comprehensive database cleaner and seeder (20 students, 6 quizzes, 87 submissions). |
| **`backend/package.json`** | Config | Added `"seed": "node seed.js"`. |
| **`frontend/src/context/PopupContext.jsx`** | Frontend | Custom toast and modal notification system (replaces native alerts). |
| **`frontend/src/pages/QuizAnalytics.jsx`** | Frontend | Visual analytics graphs, uncapped leaderboard, "Inspect Sheet" modal, live grade buttons. |
| **`frontend/src/pages/QuizSubmissions.jsx`** | Frontend | Removed average card, added top back arrow, live grade adjustment buttons. |
| **`frontend/src/pages/CreateQuiz.jsx`** | Frontend | Dual-mode AI/Manual creation, themed dark-blue inputs, grading mode selector, back arrow. |
| **`frontend/src/pages/AttemptQuiz.jsx`** | Frontend | Checkbox indicators, descriptive inputs, anti-cheat blocking. |
| **`frontend/src/pages/TeacherDashboard.jsx`**| Frontend | Sleek compact card action buttons (`.btn-card-action`). |
| **`frontend/src/pages/StudentHistory.jsx`** | Frontend | Added top back arrow, solution reviews, AI & instructor feedback display. |
| **`frontend/src/App.css`** | Styling | Blue gradient SaaS theme, compact button styles, AI card input overrides, mark toggle styles. |
| **`README.md`** | Docs | Updated project documentation, seeder commands, and demo account tables. |

---

## 6. Demo Accounts & How to Test

All accounts share the default password: **`password123`**.

### Teacher Account
- **Email**: `prof.alan@college.edu`
- **Password**: `password123`
- **What you'll see**:
  - **Active Quizzes**: 3 quizzes with 12–14 submissions each.
  - **Closed Quizzes**: 3 quizzes with 15–17 submissions each.
  - Click **Analytics** on any quiz to view the distribution charts and test the **Inspect Sheet** button to view and adjust any student's marks.

### Student Account
- **Email**: `rohan.student@college.edu`
- **Password**: `password123`
- **What you'll see**:
  - **Available Quizzes**: 3 open quizzes waiting to be attempted with the new checkboxes.
  - **My Attempts (History)**: 2 completed assessments with scores, solution reviews, and feedback notes.

---

## 7. Useful Terminal Commands

```bash
# 1. Reset and re-seed database with clean demo data:
cd backend
npm run seed

# 2. Start the backend API:
cd backend
npm start

# 3. Start the frontend client:
cd frontend
npm run dev
```
