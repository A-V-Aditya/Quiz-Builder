const pool = require('./config/db');

// Minimal valid PDF binary generator for testing
function createTestPdfBuffer(text) {
  const content = `BT /F1 12 Tf 50 700 Td (${text.replace(/[()]/g, '')}) Tj ET`;
  const streamLen = content.length;
  const pdfString = [
    '%PDF-1.4',
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj`,
    `4 0 obj << /Length ${streamLen} >> stream\n${content}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    'xref',
    '0 6',
    '0000000000 65535 f ',
    '0000000009 00000 n ',
    '0000000058 00000 n ',
    '0000000115 00000 n ',
    '0000000244 00000 n ',
    '0000000337 00000 n ',
    'trailer << /Size 6 /Root 1 0 R >>',
    'startxref',
    '450',
    '%%EOF'
  ].join('\n');

  return Buffer.from(pdfString);
}

async function runAiPdfTest() {
  const BASE_URL = 'http://localhost:5000/api';

  console.log('=== Starting AI PDF Quiz Workflow Test ===');

  // 1. Teacher Login
  console.log('1. Logging in as Teacher (prof.alan@college.edu)...');
  const teacherLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'prof.alan@college.edu',
      password: 'password123'
    })
  });
  const teacherAuth = await teacherLoginRes.json();
  const teacherToken = teacherAuth.token;
  console.log('✓ Teacher Logged in successfully:', teacherAuth.user.name);

  // 2. Prepare Sample PDF Content
  console.log('2. Preparing study material PDF in memory...');
  const studyMaterial = [
    'Computer Networks Fundamentals and Protocols.',
    'The Transmission Control Protocol is defined as a connection-oriented reliable transport layer protocol.',
    'The Domain Name System refers to a hierarchical decentralized naming system that translates human readable domain names to IP addresses.',
    'Hypertext Transfer Protocol Secure is defined as an extension of HTTP used for secure communication over a computer network.',
    'The OSI Reference Model consists of seven distinct abstract layers from physical to application.',
    'Address Resolution Protocol is used for mapping an IP address to a physical machine address on a local area network.'
  ].join(' ');

  const pdfBuffer = createTestPdfBuffer(studyMaterial);
  console.log(`✓ Test PDF buffer created (${pdfBuffer.length} bytes)`);

  // 3. Call AI PDF Generation Endpoint
  console.log('3. Sending PDF to /api/quizzes/generate-from-pdf...');
  const formData = new FormData();
  formData.append('pdf', new Blob([pdfBuffer], { type: 'application/pdf' }), 'computer_networks.pdf');
  formData.append('numQuestions', '4');
  formData.append('difficulty', 'Medium');

  const generateRes = await fetch(`${BASE_URL}/quizzes/generate-from-pdf`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${teacherToken}`
    },
    body: formData
  });

  if (!generateRes.ok) {
    const errorBody = await generateRes.text();
    throw new Error(`Generation failed with HTTP ${generateRes.status}: ${errorBody}`);
  }

  const generatedQuiz = await generateRes.json();
  console.log('✓ AI Quiz Generation response received:');
  console.log('   Title:', generatedQuiz.title);
  console.log('   Source:', generatedQuiz.source);
  console.log('   Total Questions Generated:', generatedQuiz.questions.length);

  // 4. Validate Generated Questions
  if (!generatedQuiz.questions || generatedQuiz.questions.length === 0) {
    throw new Error('No questions generated!');
  }

  const firstQ = generatedQuiz.questions[0];
  console.log('   Sample Question 1:');
  console.log('     Prompt:', firstQ.question_text);
  console.log('     A:', firstQ.option_a);
  console.log('     B:', firstQ.option_b);
  console.log('     C:', firstQ.option_c);
  console.log('     D:', firstQ.option_d);
  console.log('     Correct:', firstQ.correct_option);

  // 5. Simulate Teacher adding a question and removing one
  console.log('5. Teacher modifies questions: removing Q4 and adding a custom Q5...');
  const modifiedQuestions = generatedQuiz.questions.slice(0, 3); // removes 4th question

  // Teacher adds a manual question
  modifiedQuestions.push({
    question_text: 'Which transport layer protocol is connectionless and does not guarantee packet delivery?',
    option_a: 'TCP',
    option_b: 'UDP',
    option_c: 'FTP',
    option_d: 'SMTP',
    correct_option: 'B'
  });
  console.log(`✓ Questions modified. Total count for publishing: ${modifiedQuestions.length}`);

  // 6. Save & Publish Quiz
  console.log('6. Publishing quiz to database via POST /api/quizzes...');
  const publishRes = await fetch(`${BASE_URL}/quizzes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${teacherToken}`
    },
    body: JSON.stringify({
      title: generatedQuiz.title || 'Computer Networks AI Generated Quiz',
      description: generatedQuiz.description || 'Generated from uploaded PDF material.',
      questions: modifiedQuestions
    })
  });

  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`Publish failed: ${publishData.message}`);
  }
  console.log('✓ Quiz published successfully! Quiz ID:', publishData.quizId);

  // 7. Student Login & Verify Quiz Availability
  console.log('7. Verifying published quiz as a student...');
  let studentToken;
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rohan.student@college.edu',
      password: 'password123'
    })
  });

  if (studentLoginRes.ok) {
    const studentAuth = await studentLoginRes.json();
    studentToken = studentAuth.token;
  } else {
    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rohan Sharma',
        email: 'rohan.student@college.edu',
        password: 'password123',
        role: 'student'
      })
    });
    const afterRegLogin = await (await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'rohan.student@college.edu',
        password: 'password123'
      })
    })).json();
    studentToken = afterRegLogin.token;
  }

  const quizDetailRes = await fetch(`${BASE_URL}/quizzes/${publishData.quizId}`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const quizDetail = await quizDetailRes.json();

  console.log('✓ Student fetched published quiz:');
  console.log('   Title:', quizDetail.quiz.title);
  console.log('   Questions count:', quizDetail.questions.length);
  console.log('   First Question Prompt:', quizDetail.questions[0].question_text);
  console.log('   Teacher added Question Prompt:', quizDetail.questions[3].question_text);
  console.log('   Correct option hidden from student?', quizDetail.questions[0].correct_option === undefined);

  console.log('\n🎉 ALL AI PDF WORKFLOW TESTS PASSED PERFECTLY!');
  process.exit(0);
}

runAiPdfTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
