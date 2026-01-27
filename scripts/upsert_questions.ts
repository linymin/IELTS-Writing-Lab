
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to load env vars from .env.local
function loadEnv() {
  try {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf8');
      envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^['"](.*)['"]$/, '$1'); // Remove quotes if present
          process.env[key] = value;
        }
      });
    }
  } catch (e) {
    console.error("Error loading .env.local", e);
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function upsertQuestions() {
  const jsonPath = path.resolve(__dirname, '../ielts_questions.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('ielts_questions.json not found');
    process.exit(1);
  }

  const fileContent = fs.readFileSync(jsonPath, 'utf8');
  const questions = JSON.parse(fileContent);

  console.log(`Read ${questions.length} questions from JSON.`);

  // Prepare data for upsert
  // Ensure fields match the database schema
  const dataToUpsert = questions.map((q: any) => ({
    book_no: q.book_no,
    test_no: q.test_no,
    task_type: q.task_type,
    question_type: q.question_type,
    topic: q.topic,
    content: q.content,
    image_url: q.image_url,
    // created_at will be handled by default or we can leave it
  }));

  const { data, error } = await supabase
    .from('questions')
    .upsert(dataToUpsert, {
      onConflict: 'book_no,test_no,task_type',
      ignoreDuplicates: false // We want to update if it exists
    })
    .select();

  if (error) {
    console.error('Error upserting questions:', error);
  } else {
    console.log(`Successfully upserted ${data?.length} questions.`);
  }
}

upsertQuestions();
