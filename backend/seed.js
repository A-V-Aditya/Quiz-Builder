const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'quiz_db.sqlite');
console.log('Seeder targeting database at:', dbPath);

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ insertId: this.lastID, affectedRows: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function seed() {
  console.log('\n======================================================');
  console.log('🚀 QUIZ BUILDER - ENTERPRISE SEEDER & CLEANER');
  console.log('======================================================\n');

  try {
    // 1. Enable foreign keys
    await run('PRAGMA foreign_keys = ON;');

    // 2. Ensure schema
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await exec(schemaSql);
      console.log('✓ Database schema tables verified.');
    }

    // Ensure columns exist in SQLite tables
    try {
      const qCols = await all("PRAGMA table_info(questions)");
      const qColNames = (qCols || []).map(c => c.name);
      if (!qColNames.includes('grading_mode')) {
        await run("ALTER TABLE questions ADD COLUMN grading_mode TEXT DEFAULT 'manual';");
      }

      const aCols = await all("PRAGMA table_info(attempt_answers)");
      const aColNames = (aCols || []).map(c => c.name);
      if (!aColNames.includes('feedback')) {
        await run("ALTER TABLE attempt_answers ADD COLUMN feedback TEXT;");
      }
      if (!aColNames.includes('graded_by')) {
        await run("ALTER TABLE attempt_answers ADD COLUMN graded_by TEXT DEFAULT 'auto';");
      }
    } catch (colErr) {
      console.warn('Column verify note:', colErr.message);
    }

    // 3. Clean all previous test records
    console.log('🧹 Cleaning existing test data and quizzes...');
    await run('DELETE FROM attempt_answers;');
    await run('DELETE FROM attempts;');
    await run('DELETE FROM questions;');
    await run('DELETE FROM quizzes;');
    await run('DELETE FROM users;');

    try {
      await run("DELETE FROM sqlite_sequence WHERE name IN ('users', 'quizzes', 'questions', 'attempts', 'attempt_answers');");
      console.log('✓ Primary key sequences reset.');
    } catch (e) {}

    const defaultPassword = await bcrypt.hash('password123', 10);

    // 4. Seed Teachers (Primary teacher: Prof. Alan Turing owns the major quizzes)
    console.log('\n👨‍🏫 Seeding Teacher accounts...');
    const teachersData = [
      { name: 'Prof. Alan Turing', email: 'prof.alan@college.edu', role: 'teacher' },
      { name: 'Dr. Ada Lovelace', email: 'dr.ada@college.edu', role: 'teacher' },
      { name: 'Prof. Grace Hopper', email: 'prof.grace@college.edu', role: 'teacher' }
    ];

    const teacherMap = {};
    for (const t of teachersData) {
      const res = await run(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [t.name, t.email, defaultPassword, t.role]
      );
      teacherMap[t.email] = res.insertId;
      console.log(`  + Teacher [ID ${res.insertId}]: ${t.name} (${t.email})`);
    }

    const alanId = teacherMap['prof.alan@college.edu'];

    // 5. Seed 20 Students for massive participation
    console.log('\n🎓 Seeding 20 Student accounts...');
    const studentsData = [
      { name: 'Rohan Sharma', email: 'rohan.student@college.edu' },
      { name: 'Priya Patel', email: 'priya.student@college.edu' },
      { name: 'Aarav Mehta', email: 'aarav.student@college.edu' },
      { name: 'Ananya Iyer', email: 'ananya.student@college.edu' },
      { name: 'Vikram Singh', email: 'vikram.student@college.edu' },
      { name: 'Neha Gupta', email: 'neha.student@college.edu' },
      { name: 'Rahul Verma', email: 'rahul.student@college.edu' },
      { name: 'Sneha Kulkarni', email: 'sneha.student@college.edu' },
      { name: 'Devansh Joshi', email: 'devansh.student@college.edu' },
      { name: 'Kavya Nair', email: 'kavya.student@college.edu' },
      { name: 'Ishaan Malhotra', email: 'ishaan.student@college.edu' },
      { name: 'Meera Rao', email: 'meera.student@college.edu' },
      { name: 'Arjun Kapoor', email: 'arjun.student@college.edu' },
      { name: 'Pooja Hegde', email: 'pooja.student@college.edu' },
      { name: 'Aditya Deshmukh', email: 'aditya.student@college.edu' },
      { name: 'Tanvi Bansal', email: 'tanvi.student@college.edu' },
      { name: 'Rohit Menon', email: 'rohit.student@college.edu' },
      { name: 'Riya Sen', email: 'riya.student@college.edu' },
      { name: 'Kunal Shah', email: 'kunal.student@college.edu' },
      { name: 'Simran Kaur', email: 'simran.student@college.edu' }
    ];

    const studentMap = {};
    const studentList = [];
    for (const s of studentsData) {
      const res = await run(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [s.name, s.email, defaultPassword, 'student']
      );
      studentMap[s.email] = res.insertId;
      studentList.push({ id: res.insertId, email: s.email, name: s.name });
    }
    console.log(`  ✓ 20 students seeded (Password: password123 for all).`);

    // 6. Define 6 Rich Quizzes (all assigned to Prof. Alan Turing so the demo dashboard is fully populated!)
    // 3 Active Quizzes + 3 Closed Quizzes
    console.log('\n📝 Seeding Academic Quizzes for Teacher Alan Turing...');

    const quizzesData = [
      // QUIZ 1: ACTIVE - Modern Web Engineering & React Fundamentals
      {
        title: 'Modern Web Engineering & React Fundamentals',
        description: 'Comprehensive evaluation covering functional components, React Hooks mechanics, Virtual DOM reconciliation, and unidirectional data flow architecture.',
        status: 'open',
        disable_copy: 1,
        end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        results_policy: 'on_quiz_end',
        created_at_offset: '-2 days',
        questions: [
          {
            question_text: 'Which built-in React hook is specifically designed to perform side effects (such as data fetching or subscriptions) in functional components?',
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'useState',
            option_b: 'useMemo',
            option_c: 'useEffect',
            option_d: 'useReducer',
            correct_option: 'C'
          },
          {
            question_text: 'Which of the following are official Golden Rules of React Hooks? (Select all that apply)',
            question_type: 'multiple',
            image_url: null,
            word_limit: 0,
            option_a: 'Only call hooks at the top level of component functions',
            option_b: 'Always call hooks conditionally inside loops to save memory',
            option_c: 'Only call hooks from React function components or custom hooks',
            option_d: 'Hooks can only be declared inside class render methods',
            correct_option: 'A,C'
          },
          {
            question_text: "What is the primary architectural performance advantage of React's Virtual DOM reconciliation engine?",
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'Directly writes to browser GPU textures',
            option_b: 'Minimizes costly real DOM reflows and repaints via batched diffing',
            option_c: 'Eliminates the requirement for JavaScript in modern browsers',
            option_d: 'Stores component state securely on remote CDNs',
            correct_option: 'B'
          },
          {
            question_text: 'Explain the concept of Unidirectional Data Flow in React and why it simplifies state debugging.',
            question_type: 'descriptive',
            image_url: null,
            word_limit: 120,
            option_a: null,
            option_b: null,
            option_c: null,
            option_d: null,
            correct_option: 'In React, state strictly flows downward from parent to child via props. Child components emit events or invoke callbacks to ask parents to mutate state. This single source of truth ensures predictable state transitions and makes debugging effortless.'
          }
        ]
      },

      // QUIZ 2: ACTIVE - Database Systems & SQL Optimization
      {
        title: 'Database Systems & SQL Optimization',
        description: 'Examines relational database internals: ACID transaction properties, indexing mechanics (clustered vs secondary), query execution plans, and normalization tradeoffs.',
        status: 'open',
        disable_copy: 1,
        end_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        results_policy: 'immediate_score_only',
        created_at_offset: '-1 day',
        questions: [
          {
            question_text: 'In database ACID transactions, which property ensures that all operations within a transaction commit together or roll back completely on failure?',
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'Atomicity',
            option_b: 'Consistency',
            option_c: 'Isolation',
            option_d: 'Durability',
            correct_option: 'A'
          },
          {
            question_text: 'Which of the following query patterns typically cause the database engine to bypass an index and trigger a full table scan? (Select all that apply)',
            question_type: 'multiple',
            image_url: null,
            word_limit: 0,
            option_a: 'Using a leading wildcard like WHERE title LIKE "%algo"',
            option_b: 'Direct equality lookup on the primary key column',
            option_c: 'Applying a scalar function directly to an indexed column in the WHERE clause',
            option_d: 'Bounded range scan on an indexed integer column',
            correct_option: 'A,C'
          },
          {
            question_text: 'How does a Clustered Index fundamentally differ from a Non-Clustered (Secondary) Index?',
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'A clustered index resides strictly in memory and is never written to disk',
            option_b: 'A clustered index physically reorders and stores table data rows at the leaf level',
            option_c: 'A single table can easily have up to 256 clustered indexes',
            option_d: 'Clustered indexes do not support B-Tree searches',
            correct_option: 'B'
          },
          {
            question_text: 'Discuss the practical architectural trade-offs between database Normalization (3NF/BCNF) and Denormalization in high-throughput applications.',
            question_type: 'descriptive',
            image_url: null,
            word_limit: 100,
            option_a: null,
            option_b: null,
            option_c: null,
            option_d: null,
            correct_option: 'Normalization prevents anomalies, eliminates redundancy, and speeds up write operations. However, complex joins degrade read latency in analytical queries. Denormalization purposefully duplicates data to accelerate heavy read workloads at the cost of higher storage and sync complexity.'
          }
        ]
      },

      // QUIZ 3: ACTIVE - Cybersecurity & Web Application Defense
      {
        title: 'Cybersecurity & Web Application Defense',
        description: 'Essential web security: OWASP Top 10 vulnerabilities, parameterized SQL protection, security HTTP headers, and XSS sanitization.',
        status: 'open',
        disable_copy: 1,
        end_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        results_policy: 'immediate_full',
        created_at_offset: '-12 hours',
        questions: [
          {
            question_text: 'Which software development pattern represents the primary industry standard defense against SQL Injection attacks?',
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'Client-side regular expression input masking',
            option_b: 'Parameterized queries (Prepared Statements) with bound parameters',
            option_c: 'Scrambling table names at runtime',
            option_d: 'Restricting all web access to HTTPS only',
            correct_option: 'B'
          },
          {
            question_text: 'Which of the following HTTP response headers directly enhance browser-side defense against web attacks? (Select all that apply)',
            question_type: 'multiple',
            image_url: null,
            word_limit: 0,
            option_a: 'Content-Security-Policy (CSP)',
            option_b: 'Strict-Transport-Security (HSTS)',
            option_c: 'X-Frame-Options',
            option_d: 'Accept-Encoding',
            correct_option: 'A,B,C'
          },
          {
            question_text: 'Define Cross-Site Scripting (XSS) and explain two effective countermeasures used to protect modern web applications.',
            question_type: 'descriptive',
            image_url: null,
            word_limit: 90,
            option_a: null,
            option_b: null,
            option_c: null,
            option_d: null,
            correct_option: 'XSS occurs when malicious scripts are injected into trusted websites and executed in unsuspecting victim browsers. Countermeasures include context-aware HTML output sanitization and implementing a strict Content-Security-Policy header blocking untrusted scripts.'
          }
        ]
      },

      // QUIZ 4: CLOSED - Data Structures & Algorithms Mastery
      {
        title: 'Data Structures & Algorithms Mastery',
        description: 'Comprehensive assessment covering binary tree search complexities, LIFO/FIFO data structures, sorting paradigms, and graph traversal strategies.',
        status: 'closed',
        disable_copy: 1,
        end_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        results_policy: 'on_quiz_end',
        created_at_offset: '-5 days',
        questions: [
          {
            question_text: 'What is the average time complexity of searching in a balanced Binary Search Tree (BST)?',
            question_type: 'single',
            image_url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=600&q=80',
            word_limit: 0,
            option_a: 'O(1)',
            option_b: 'O(log n)',
            option_c: 'O(n)',
            option_d: 'O(n log n)',
            correct_option: 'B'
          },
          {
            question_text: 'Which of the following data structures are considered linear data structures? (Select all that apply)',
            question_type: 'multiple',
            image_url: null,
            word_limit: 0,
            option_a: 'One-dimensional Array',
            option_b: 'Binary Search Tree',
            option_c: 'Singly Linked List',
            option_d: 'Directed Acyclic Graph',
            correct_option: 'A,C'
          },
          {
            question_text: 'Which of the following abstract data structures operates strictly on a Last-In, First-Out (LIFO) protocol?',
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'Circular Queue',
            option_b: 'Double Ended Queue',
            option_c: 'Call Stack',
            option_d: 'Priority Queue',
            correct_option: 'C'
          },
          {
            question_text: 'Which of the following sorting algorithms guarantee an average time complexity of O(n log n)? (Select all that apply)',
            question_type: 'multiple',
            image_url: null,
            word_limit: 0,
            option_a: 'Merge Sort',
            option_b: 'Bubble Sort',
            option_c: 'Heap Sort',
            option_d: 'Insertion Sort',
            correct_option: 'A,C'
          },
          {
            question_text: 'Explain the fundamental difference between Breadth-First Search (BFS) and Depth-First Search (DFS) in graph traversal, and cite one practical application for each.',
            question_type: 'descriptive',
            image_url: null,
            word_limit: 120,
            option_a: null,
            option_b: null,
            option_c: null,
            option_d: null,
            correct_option: 'BFS traverses level-by-level using a Queue (ideal for shortest path in unweighted graphs or social network friend-hops). DFS dives deep along paths using a Stack or recursion (ideal for topological sorting, cycle detection, or solving maze puzzles).'
          }
        ]
      },

      // QUIZ 5: CLOSED - Cloud Computing & Distributed Systems
      {
        title: 'Cloud Computing & Distributed Systems',
        description: 'Examines the core tenets of distributed computing: the CAP theorem, NIST cloud characteristics, stateless REST architecture, and scaling economics.',
        status: 'closed',
        disable_copy: 1,
        end_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        results_policy: 'immediate_full',
        created_at_offset: '-4 days',
        questions: [
          {
            question_text: "According to Eric Brewer's CAP Theorem, which three guarantees cannot be simultaneously provided in an asynchronous distributed data store over an unreliable network?",
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'Consistency, Availability, Partition Tolerance',
            option_b: 'Concurrency, Atomicity, Performance',
            option_c: 'Coherence, Access, Parallelism',
            option_d: 'Capacity, Accuracy, Persistence',
            correct_option: 'A'
          },
          {
            question_text: 'Which of the following are recognized by NIST as essential characteristics of Cloud Computing? (Select all that apply)',
            question_type: 'multiple',
            image_url: null,
            word_limit: 0,
            option_a: 'On-demand self-service',
            option_b: 'Mandatory on-premise server ownership',
            option_c: 'Broad network access',
            option_d: 'Rapid elasticity and resource pooling',
            correct_option: 'A,C,D'
          },
          {
            question_text: 'Which fundamental application-layer protocol is inherently stateless and serves as the foundation for modern web APIs and microservices?',
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'FTP',
            option_b: 'HTTP',
            option_c: 'SMTP',
            option_d: 'Telnet',
            correct_option: 'B'
          },
          {
            question_text: 'Compare Horizontal Scaling (Scale-Out) vs Vertical Scaling (Scale-Up). Briefly discuss their trade-offs in cloud deployments.',
            question_type: 'descriptive',
            image_url: null,
            word_limit: 100,
            option_a: null,
            option_b: null,
            option_c: null,
            option_d: null,
            correct_option: 'Vertical scaling increases CPU/RAM of one machine—simple with zero network latency, but hits hardware limits and single point of failure. Horizontal scaling provisions multiple commodity servers behind load balancers—enables high resilience, fault tolerance, and cost efficiency in cloud systems.'
          }
        ]
      },

      // QUIZ 6: CLOSED - Operating Systems & Concurrency
      {
        title: 'Operating Systems & Concurrency',
        description: 'Process synchronization, thread scheduling algorithms, deadlock Coffman conditions, and virtual memory page replacement policies.',
        status: 'closed',
        disable_copy: 1,
        end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        results_policy: 'immediate_score_only',
        created_at_offset: '-3 days',
        questions: [
          {
            question_text: 'Which of the following is NOT one of the four necessary Coffman conditions required for a deadlock to occur?',
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'Mutual Exclusion',
            option_b: 'Preemption Allowed',
            option_c: 'Hold and Wait',
            option_d: 'Circular Wait',
            correct_option: 'B'
          },
          {
            question_text: 'Which page replacement algorithms suffer from Belady\'s Anomaly? (Select all that apply)',
            question_type: 'multiple',
            image_url: null,
            word_limit: 0,
            option_a: 'FIFO (First-In, First-Out)',
            option_b: 'LRU (Least Recently Used)',
            option_c: 'Second Chance Algorithm',
            option_d: 'Optimal Page Replacement',
            correct_option: 'A,C'
          },
          {
            question_text: 'What synchronization primitive allows multiple concurrent readers but ensures exclusive access for writers?',
            question_type: 'single',
            image_url: null,
            word_limit: 0,
            option_a: 'Spinlock',
            option_b: 'Binary Semaphore',
            option_c: 'Read-Write Lock (Shared-Exclusive Mutex)',
            option_d: 'Barrier',
            correct_option: 'C'
          },
          {
            question_text: 'Explain the critical difference between a Process and a Thread regarding memory space and execution context.',
            question_type: 'descriptive',
            image_url: null,
            word_limit: 100,
            option_a: null,
            option_b: null,
            option_c: null,
            option_d: null,
            correct_option: 'A process is an independent execution unit with its own private virtual address space and isolated resources. A thread is a lightweight dispatchable sub-unit of a process that shares code, data, and heap segments with peer threads while retaining its own stack and registers.'
          }
        ]
      }
    ];

    // Seed each quiz, its questions, and 12-16 student attempts for EACH quiz!
    for (let qIdx = 0; qIdx < quizzesData.length; qIdx++) {
      const qData = quizzesData[qIdx];
      const qRes = await run(
        `INSERT INTO quizzes (teacher_id, title, description, status, disable_copy, end_date, results_policy, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
        [
          alanId,
          qData.title,
          qData.description,
          qData.status,
          qData.disable_copy,
          qData.end_date,
          qData.results_policy,
          qData.created_at_offset
        ]
      );
      const quizId = qRes.insertId;

      const questionIds = [];
      for (const question of qData.questions) {
        const questGradingMode = question.question_type === 'descriptive' ? (question.grading_mode || 'manual') : null;
        const questRes = await run(
          `INSERT INTO questions (quiz_id, question_text, question_type, grading_mode, image_url, word_limit, option_a, option_b, option_c, option_d, correct_option)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            quizId,
            question.question_text,
            question.question_type,
            questGradingMode,
            question.image_url,
            question.word_limit,
            question.option_a,
            question.option_b,
            question.option_c,
            question.option_d,
            question.correct_option
          ]
        );
        questionIds.push({
          id: questRes.insertId,
          type: question.question_type,
          correct: question.correct_option,
          grading_mode: questGradingMode
        });
      }

      // Determine participants for this quiz:
      // For Active Quizzes (Quizzes 0, 1, 2): 12 to 15 students participate (excluding Rohan Sharma on Quizzes 0 & 1 so Rohan can attempt them live!)
      // For Closed Quizzes (Quizzes 3, 4, 5): 15 to 18 students participate (including Rohan Sharma on Quizzes 3 & 4 so Rohan has rich past history!)
      let participants = [];
      if (qIdx === 0) {
        // Active Quiz 1 (Web Engineering): 14 students (excluding Rohan)
        participants = studentList.filter(s => s.email !== 'rohan.student@college.edu').slice(0, 14);
      } else if (qIdx === 1) {
        // Active Quiz 2 (SQL Optimization): 13 students (excluding Rohan)
        participants = studentList.filter(s => s.email !== 'rohan.student@college.edu').slice(2, 15);
      } else if (qIdx === 2) {
        // Active Quiz 3 (Cybersecurity): 12 students (excluding Rohan)
        participants = studentList.filter(s => s.email !== 'rohan.student@college.edu').slice(4, 16);
      } else if (qIdx === 3) {
        // Closed Quiz 4 (DSA Mastery): 17 students (including Rohan)
        participants = studentList.slice(0, 17);
      } else if (qIdx === 4) {
        // Closed Quiz 5 (Cloud Computing): 16 students (including Rohan)
        participants = studentList.slice(0, 16);
      } else if (qIdx === 5) {
        // Closed Quiz 6 (Operating Systems): 15 students (excluding Rohan)
        participants = studentList.slice(2, 17);
      }

      console.log(`  + Quiz [ID ${quizId}]: "${qData.title}" (${qData.status.toUpperCase()}) -> Seeding ${participants.length} student attempts...`);

      // Seed attempts for all participants in this quiz
      for (let pIdx = 0; pIdx < participants.length; pIdx++) {
        const student = participants[pIdx];
        
        // Realistic score tiers:
        // Top 20% score 100%, next 35% score ~75-80%, next 30% score ~50-60%, bottom 15% score ~25%
        let studentTier = 'mid';
        if (pIdx <= 2) studentTier = 'high';
        else if (pIdx <= 7) studentTier = 'mid-high';
        else if (pIdx <= 12) studentTier = 'mid';
        else studentTier = 'low';

        let score = 0;
        const answersToInsert = [];

        for (let qNumber = 0; qNumber < questionIds.length; qNumber++) {
          const qInfo = questionIds[qNumber];
          let isCorrect = false;
          let selectedOption = '';

          // Determine probability of correct answer based on tier
          const roll = Math.random();
          let shouldBeCorrect = false;
          if (studentTier === 'high') shouldBeCorrect = true;
          else if (studentTier === 'mid-high') shouldBeCorrect = roll < 0.85;
          else if (studentTier === 'mid') shouldBeCorrect = roll < 0.60;
          else shouldBeCorrect = roll < 0.35;

          let feedback = null;
          let gradedBy = 'auto';

          if (qInfo.type === 'single') {
            if (shouldBeCorrect) {
              isCorrect = true;
              selectedOption = qInfo.correct;
            } else {
              isCorrect = false;
              // Choose a wrong option
              const wrongOptions = ['A', 'B', 'C', 'D'].filter(opt => opt !== qInfo.correct);
              selectedOption = wrongOptions[pIdx % wrongOptions.length];
            }
          } else if (qInfo.type === 'multiple') {
            if (shouldBeCorrect) {
              isCorrect = true;
              selectedOption = qInfo.correct;
            } else {
              isCorrect = false;
              // Pick only first option or wrong combination
              selectedOption = qInfo.correct.split(',')[0];
            }
          } else if (qInfo.type === 'descriptive') {
            gradedBy = qInfo.grading_mode || 'manual';
            if (shouldBeCorrect) {
              isCorrect = true;
              selectedOption = `The core architectural difference involves ${qInfo.correct.substring(0, 60)}... which guarantees optimal system performance.`;
              feedback = gradedBy === 'ai'
                ? 'AI Assessment: Comprehensive response demonstrating grasp of foundational concepts.'
                : 'Full mark awarded by instructor.';
            } else {
              // 50% blank, 50% partial
              if (roll < 0.3) {
                isCorrect = false;
                selectedOption = '';
                feedback = 'No response provided.';
              } else {
                isCorrect = true;
                selectedOption = 'A concise overview explaining the key tradeoffs and operational principles.';
                feedback = 'Full mark awarded (Teacher manual grading).';
              }
            }
          }

          if (isCorrect) score++;

          answersToInsert.push({
            question_id: qInfo.id,
            selected_option: selectedOption,
            is_correct: isCorrect ? 1 : 0,
            feedback,
            graded_by: gradedBy
          });
        }

        // Calculate staggered submission time
        const hourOffset = (participants.length - pIdx) * 2;
        const submittedTime = new Date(Date.now() - (qIdx + 1) * 24 * 3600 * 1000 + hourOffset * 1800 * 1000)
          .toISOString()
          .replace('T', ' ')
          .substring(0, 19);

        const attRes = await run(
          `INSERT INTO attempts (quiz_id, student_id, score, total_questions, submitted_at)
           VALUES (?, ?, ?, ?, ?)`,
          [quizId, student.id, score, questionIds.length, submittedTime]
        );
        const attemptId = attRes.insertId;

        for (const ans of answersToInsert) {
          await run(
            `INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_correct, feedback, graded_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [attemptId, ans.question_id, ans.selected_option, ans.is_correct, ans.feedback, ans.graded_by]
          );
        }
      }
      console.log(`    ✓ ${participants.length} attempts inserted with realistic answer sheets.`);
    }

    // 7. Print Final Verification Summary
    const [userCount] = await all('SELECT COUNT(*) as count FROM users');
    const [quizCount] = await all('SELECT COUNT(*) as count FROM quizzes');
    const [questionCount] = await all('SELECT COUNT(*) as count FROM questions');
    const [attemptCount] = await all('SELECT COUNT(*) as count FROM attempts');
    const [answerCount] = await all('SELECT COUNT(*) as count FROM attempt_answers');
    const [activeQuizCount] = await all("SELECT COUNT(*) as count FROM quizzes WHERE status = 'open'");
    const [closedQuizCount] = await all("SELECT COUNT(*) as count FROM quizzes WHERE status = 'closed'");

    console.log('\n======================================================');
    console.log('🎉 SEEDING COMPLETED WITH MASSIVE REAL PARTICIPATION!');
    console.log('======================================================');
    console.log(`• Users created:            ${userCount.count} (3 Teachers, 20 Students)`);
    console.log(`• Quizzes created:          ${quizCount.count} (${activeQuizCount.count} Active/Open, ${closedQuizCount.count} Closed/Past)`);
    console.log(`• Questions created:        ${questionCount.count}`);
    console.log(`• Total student attempts:   ${attemptCount.count} (Average ~15 students per quiz!)`);
    console.log(`• Total recorded answers:   ${answerCount.count}`);
    console.log('------------------------------------------------------');
    console.log('🔑 ALL QUIZZES ARE OWNED BY DEMO TEACHER:');
    console.log('   Email: prof.alan@college.edu');
    console.log('   Password: password123');
    console.log('');
    console.log('   -> Teacher Dashboard will show:');
    console.log(`      Active Quizzes: 3 (with 12-14 student submissions each)`);
    console.log(`      Closed Quizzes: 3 (with 15-17 student submissions each)`);
    console.log('------------------------------------------------------');
    console.log('🎓 DEMO STUDENT ACCOUNT:');
    console.log('   Email: rohan.student@college.edu');
    console.log('   Password: password123');
    console.log('');
    console.log('   -> Student Dashboard will show:');
    console.log('      3 Available Quizzes ready to attempt live!');
    console.log('      2 Past Completed Quizzes in history with review & solutions!');
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Error during seeding:', err);
    process.exit(1);
  } finally {
    db.close();
  }
}

seed();
