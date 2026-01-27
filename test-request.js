
// const fetch = require('node-fetch'); // Use native fetch

async function test() {
  try {
    const response = await fetch('http://localhost:3000/api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_type: 'task2',
        question_text: 'Some people think that technology is making people less social. To what extent do you agree or disagree?',
        essay_body: 'In the modern era, technology has revolutionized the way we communicate. While some argue that it isolates individuals, I believe that it actually enhances social connectivity. Firstly, social media platforms allow us to stay in touch with friends and family across the globe. Secondly, video calls provide a more personal way to interact than traditional letters. However, excessive use of devices can lead to less face-to-face interaction. In conclusion, technology is a tool that, when used wisely, brings people together rather than driving them apart. This essay should be long enough to pass the 50 character limit check easily.'
      })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
