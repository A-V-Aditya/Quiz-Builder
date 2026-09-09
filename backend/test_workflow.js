// Test script to verify API workflow
async function runTests() {
  const BASE_URL = 'http://localhost:5000/api';

  console.log('--- 1. Registering Student ---');
  const regRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Sharma',
      email: 'rohan.student@college.edu',
      password: 'password123',
      role: 'student'
    })
  });
  const regData = await regRes.json();
  console.log('Student Registration:', regData);

  console.log('\n--- 2. Logging in Student ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rohan.student@college.edu',
      password: 'password123'
    })
  });
  const studentAuth = await loginRes.json();
  console.log('Student Logged In:', studentAuth.user.name);
  const studentToken = studentAuth.token;

  console.log('\n--- 3. Fetching Available Quizzes for Student ---');
  const availRes = await fetch(`${BASE_URL}/quizzes/available`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const availableQuizzes = await availRes.json();
  console.log('Available Quizzes count:', availableQuizzes.length);
  const targetQuiz = availableQuizzes[0];
  console.log('Target Quiz:', targetQuiz.title, 'ID:', targetQuiz.id);

  console.log('\n--- 4. Fetching Quiz Details as Student (Should NOT reveal correct_option) ---');
  const quizDetailRes = await fetch(`${BASE_URL}/quizzes/${targetQuiz.id}`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const quizDetail = await quizDetailRes.json();
  console.log('Questions received:', quizDetail.questions.length);
  console.log('Has correct_option leaked?', quizDetail.questions[0].correct_option !== undefined);

  console.log('\n--- 5. Submitting Quiz Attempt (Answering Q1: B, Q2: C) ---');
  const submitRes = await fetch(`${BASE_URL}/attempts/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      quiz_id: targetQuiz.id,
      answers: [
        { question_id: quizDetail.questions[0].id, selected_option: 'B' },
        { question_id: quizDetail.questions[1].id, selected_option: 'C' }
      ]
    })
  });
  const submitData = await submitRes.json();
  console.log('Attempt Submission Response:', submitData);

  console.log('\n--- 6. Checking Student Past Attempts (Quiz is OPEN -> score MUST be null) ---');
  const historyRes = await fetch(`${BASE_URL}/attempts/student`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const history = await historyRes.json();
  console.log('Student Attempt Record:', history[0]);
  if (history[0].score === null) {
    console.log('SUCCESS: Student score is hidden because quiz is still open!');
  } else {
    console.error('FAILURE: Student score should not be visible yet!');
  }

  console.log('\n--- 7. Logging in as Teacher to View Submissions ---');
  const teacherLogin = await (await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'prof.alan@college.edu',
      password: 'password123'
    })
  })).json();
  const teacherToken = teacherLogin.token;

  const submissionsRes = await fetch(`${BASE_URL}/attempts/quiz/${targetQuiz.id}`, {
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  const submissionsData = await submissionsRes.json();
  console.log('Teacher view submissions count:', submissionsData.submissions.length);
  console.log('Teacher sees Student score:', submissionsData.submissions[0].student_name, 'Score:', submissionsData.submissions[0].score, '/', submissionsData.submissions[0].total_questions);

  console.log('\n--- 8. Teacher Closes the Quiz ---');
  const closeRes = await fetch(`${BASE_URL}/quizzes/${targetQuiz.id}/close`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${teacherToken}` }
  });
  console.log('Close Quiz Response:', await closeRes.json());

  console.log('\n--- 9. Checking Student History Now (Quiz is CLOSED -> score MUST be revealed) ---');
  const historyAfterClose = await (await fetch(`${BASE_URL}/attempts/student`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  })).json();
  console.log('Student Attempt Record After Close:', historyAfterClose[0]);
  if (historyAfterClose[0].score !== null && historyAfterClose[0].quiz_status === 'closed') {
    console.log(`SUCCESS: Student can now see score: ${historyAfterClose[0].score} / ${historyAfterClose[0].total_questions}!`);
  } else {
    console.error('FAILURE: Score was not revealed after closing!');
  }

  console.log('\n--- 10. Student Checks Detailed Review (Solution) ---');
  const detailRes = await fetch(`${BASE_URL}/attempts/detail/${historyAfterClose[0].attempt_id}`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  const detailData = await detailRes.json();
  console.log('Detailed answers visible to student:', detailData.answers.length);
  console.log('Q1 student answer:', detailData.answers[0].selected_option, 'Correct:', detailData.answers[0].correct_option, 'is_correct:', detailData.answers[0].is_correct);

  console.log('\nALL WORKFLOW TESTS COMPLETED SUCCESSFULLY!');
}

runTests().catch(console.error);
