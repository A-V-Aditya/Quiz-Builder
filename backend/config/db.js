const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

const dbPath = path.resolve(__dirname, '..', process.env.DB_FILE || 'quiz_db.sqlite');

// Open SQLite database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite Database:', err.message);
  } else {
    console.log(`Connected to SQLite Database successfully at: ${dbPath}`);
  }
});

// Enable Foreign Key constraints in SQLite
db.run('PRAGMA foreign_keys = ON;');

// Helper to determine whether a query is a write/command or a read
function getQueryType(sql) {
  const cleanSql = sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim();
  return cleanSql.split(/\s+/)[0].toUpperCase();
}

// Execute query returning [rows/result, fields] for MySQL compatibility
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const safeParams = (params || []).map(p => (p === undefined ? null : p));
    const command = getQueryType(sql);

    if (['INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'CREATE', 'DROP', 'ALTER', 'BEGIN', 'COMMIT', 'ROLLBACK'].includes(command)) {
      db.run(sql, safeParams, function (err) {
        if (err) return reject(err);
        resolve([{ insertId: this.lastID, affectedRows: this.changes }, []]);
      });
    } else {
      db.all(sql, safeParams, (err, rows) => {
        if (err) return reject(err);
        resolve([rows || [], []]);
      });
    }
  });
}

// Transaction lock mutex to ensure serialized transactions in SQLite
let transactionMutex = Promise.resolve();

function getConnection() {
  let releaseMutex = null;
  let inTransaction = false;

  return {
    query: (sql, params) => query(sql, params),
    execute: (sql, params) => query(sql, params),

    async beginTransaction() {
      let prevMutex = transactionMutex;
      let resolver;
      transactionMutex = new Promise((resolve) => {
        resolver = resolve;
      });
      await prevMutex;
      releaseMutex = resolver;
      inTransaction = true;
      await query('BEGIN TRANSACTION');
    },

    async commit() {
      if (inTransaction) {
        await query('COMMIT');
        inTransaction = false;
        if (releaseMutex) {
          releaseMutex();
          releaseMutex = null;
        }
      }
    },

    async rollback() {
      if (inTransaction) {
        try {
          await query('ROLLBACK');
        } catch (e) {
          // ignore if already rolled back
        }
        inTransaction = false;
        if (releaseMutex) {
          releaseMutex();
          releaseMutex = null;
        }
      }
    },

    release() {
      if (inTransaction && releaseMutex) {
        query('ROLLBACK')
          .catch(() => {})
          .finally(() => {
            if (releaseMutex) {
              releaseMutex();
              releaseMutex = null;
            }
            inTransaction = false;
          });
      }
    }
  };
}

// Initialize tables, run migrations, and seed default accounts
async function initDatabase() {
  try {
    const schemaPath = path.resolve(__dirname, '..', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await new Promise((resolve, reject) => {
        db.exec(schemaSql, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      console.log('SQLite database tables verified/initialized.');
    }

    // Auto-migrate tables if needed
    try {
      const [cols] = await query("PRAGMA table_info(questions)");
      const colNames = (cols || []).map(c => c.name);

      if (!colNames.includes('question_type')) {
        console.log('Migrating questions table...');
        await query("PRAGMA foreign_keys = OFF;");
        await query(`
          CREATE TABLE IF NOT EXISTS questions_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quiz_id INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            question_type TEXT DEFAULT 'single',
            image_url TEXT,
            word_limit INTEGER DEFAULT 0,
            option_a TEXT,
            option_b TEXT,
            option_c TEXT,
            option_d TEXT,
            correct_option TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
          );
        `);
        await query(`
          INSERT INTO questions_new (id, quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option)
          SELECT id, quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option FROM questions;
        `);
        await query("DROP TABLE questions;");
        await query("ALTER TABLE questions_new RENAME TO questions;");
        await query("PRAGMA foreign_keys = ON;");
        console.log('Questions table migration complete.');
      }
    } catch (migErr) {
      console.warn('Questions migration note:', migErr.message);
    }

    try {
      const [ansSql] = await query("SELECT sql FROM sqlite_master WHERE type='table' AND name='attempt_answers'");
      if (ansSql.length > 0 && ansSql[0].sql && ansSql[0].sql.includes('CHECK')) {
        console.log('Migrating attempt_answers table...');
        await query("PRAGMA foreign_keys = OFF;");
        await query(`
          CREATE TABLE IF NOT EXISTS attempt_answers_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            attempt_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            selected_option TEXT,
            is_correct INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
          );
        `);
        await query(`
          INSERT INTO attempt_answers_new (id, attempt_id, question_id, selected_option, is_correct)
          SELECT id, attempt_id, question_id, selected_option, is_correct FROM attempt_answers;
        `);
        await query("DROP TABLE attempt_answers;");
        await query("ALTER TABLE attempt_answers_new RENAME TO attempt_answers;");
        await query("PRAGMA foreign_keys = ON;");
        console.log('Attempt_answers migration complete.');
      }
    } catch (migErr) {
      console.warn('Attempt_answers migration note:', migErr.message);
    }

    try {
      const [qCols] = await query("PRAGMA table_info(quizzes)");
      const qColNames = (qCols || []).map(c => c.name);
      if (!qColNames.includes('disable_copy')) {
        await query("ALTER TABLE quizzes ADD COLUMN disable_copy INTEGER DEFAULT 1;");
        console.log('Added disable_copy column to quizzes.');
      }
      if (!qColNames.includes('end_date')) {
        await query("ALTER TABLE quizzes ADD COLUMN end_date TEXT;");
        console.log('Added end_date column to quizzes.');
      }
      if (!qColNames.includes('results_policy')) {
        await query("ALTER TABLE quizzes ADD COLUMN results_policy TEXT DEFAULT 'on_quiz_end';");
        console.log('Added results_policy column to quizzes.');
      }

      // Check questions table for grading_mode
      const [questionCols] = await query("PRAGMA table_info(questions)");
      const questColNames = (questionCols || []).map(c => c.name);
      if (!questColNames.includes('grading_mode')) {
        await query("ALTER TABLE questions ADD COLUMN grading_mode TEXT DEFAULT 'manual';");
        console.log('Added grading_mode column to questions.');
      }

      // Check attempt_answers table for feedback and graded_by
      const [ansCols] = await query("PRAGMA table_info(attempt_answers)");
      const ansColNames = (ansCols || []).map(c => c.name);
      if (!ansColNames.includes('feedback')) {
        await query("ALTER TABLE attempt_answers ADD COLUMN feedback TEXT;");
        console.log('Added feedback column to attempt_answers.');
      }
      if (!ansColNames.includes('graded_by')) {
        await query("ALTER TABLE attempt_answers ADD COLUMN graded_by TEXT DEFAULT 'auto';");
        console.log('Added graded_by column to attempt_answers.');
      }
    } catch (migErr) {
      console.warn('Quizzes column add note:', migErr.message);
    }

    const hashedPw = await bcrypt.hash('password123', 10);

    // 1. Ensure Demo Teacher exists
    const [teacherRows] = await query('SELECT id FROM users WHERE email = ?', ['prof.alan@college.edu']);
    let teacherId;
    if (teacherRows.length === 0) {
      const [teacherResult] = await query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Prof. Alan Turing', 'prof.alan@college.edu', hashedPw, 'teacher']
      );
      teacherId = teacherResult.insertId;
      console.log('Demo teacher account created: prof.alan@college.edu / password123');
    } else {
      teacherId = teacherRows[0].id;
    }

    // 2. Ensure Demo Student exists
    const [studentRows] = await query('SELECT id FROM users WHERE email = ?', ['rohan.student@college.edu']);
    if (studentRows.length === 0) {
      await query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Rohan Sharma', 'rohan.student@college.edu', hashedPw, 'student']
      );
      console.log('Demo student account created: rohan.student@college.edu / password123');
    }

    // 3. Ensure Sample Quiz exists
    const [quizRows] = await query('SELECT id FROM quizzes LIMIT 1');
    if (quizRows.length === 0 && teacherId) {
      const [quizResult] = await query(
        "INSERT INTO quizzes (teacher_id, title, description, status, disable_copy) VALUES (?, ?, ?, 'open', 1)",
        [
          teacherId,
          'Data Structures & Algorithms Quiz',
          'Fundamental quiz covering time complexity, stacks, and data structures.'
        ]
      );

      const quizId = quizResult.insertId;

      await query(
        'INSERT INTO questions (quiz_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [quizId, 'What is the average time complexity of searching in a balanced Binary Search Tree (BST)?', 'single', 'O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'B']
      );

      await query(
        'INSERT INTO questions (quiz_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [quizId, 'Which of the following data structures operates on a Last-In, First-Out (LIFO) basis?', 'single', 'Queue', 'Array', 'Stack', 'Linked List', 'C']
      );

      await query(
        'INSERT INTO questions (quiz_id, question_text, question_type, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [quizId, 'Which sorting algorithm has a worst-case time complexity of O(n^2)?', 'single', 'Merge Sort', 'Quick Sort', 'Heap Sort', 'Radix Sort', 'B']
      );
    }
  } catch (err) {
    console.error('Error during SQLite database initialization:', err.message);
  }
}

initDatabase();

const pool = {
  query,
  execute: query,
  getConnection,
  db
};

module.exports = pool;
