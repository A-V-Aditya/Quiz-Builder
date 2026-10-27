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

// Initialize tables and seed default teacher/quiz if database is fresh
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

    // Seed demo teacher account if none exists
    const [existingUsers] = await query('SELECT id FROM users LIMIT 1');
    if (existingUsers.length === 0) {
      console.log('Seeding initial demo data (Teacher and sample quiz)...');
      const hashedPw = await bcrypt.hash('password123', 10);

      // Teacher
      const [teacherResult] = await query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Prof. Alan Turing', 'prof.alan@college.edu', hashedPw, 'teacher']
      );

      // Sample Quiz
      const [quizResult] = await query(
        "INSERT INTO quizzes (teacher_id, title, description, status) VALUES (?, ?, ?, 'open')",
        [
          teacherResult.insertId,
          'Data Structures & Algorithms Quiz',
          'Fundamental quiz covering time complexity, stacks, and data structures.'
        ]
      );

      const quizId = quizResult.insertId;

      // Sample Questions
      await query(
        'INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [quizId, 'What is the average time complexity of searching in a balanced Binary Search Tree (BST)?', 'O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'B']
      );

      await query(
        'INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [quizId, 'Which of the following data structures operates on a Last-In, First-Out (LIFO) basis?', 'Queue', 'Array', 'Stack', 'Linked List', 'C']
      );

      await query(
        'INSERT INTO questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [quizId, 'Which sorting algorithm has a worst-case time complexity of O(n^2)?', 'Merge Sort', 'Quick Sort', 'Heap Sort', 'Radix Sort', 'B']
      );

      console.log('Demo teacher (prof.alan@college.edu / password123) and sample quiz seeded successfully!');
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
