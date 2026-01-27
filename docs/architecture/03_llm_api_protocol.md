---
title: IELTS Writing LLM API Protocol
version: 1.0.0
date: 2026-01-23
author: Trae AI Architect
---

# LLM API Protocol: Evaluation Endpoint

This document defines the contract for the single `POST /evaluate` endpoint used to interface with the LLM scoring engine.

## 1. API Endpoint Definition

- **Method**: `POST`
- **Path**: `/api/v1/evaluate`
- **Access Control**: Authenticated (Bearer Token)
- **Rate Limit**: 10 requests / minute / user

## 2. Request Payload

```json
{
  "essay_body": "The chart shows the percentage of...",
  "task_type": "task1",
  "question_text": "Summarize the information by selecting and reporting the main features...",
  "user_history": [
    {
      "essay_id": "uuid-prev-1",
      "overall_band": 6.0,
      "feedback_summary": "Focus on Lexical Resource."
    }
  ]
}
```

## 3. Prompt Engineering Strategy

The backend will construct the prompt by injecting the official IELTS Rubric text verbatim.

**Prompt Template Structure:**

> You are an expert IELTS examiner. Evaluate the following {task_type} essay.
>
> **Rubric Context**:
> - **Task Response**: {Inject TR Rubric Text}
> - **Coherence & Cohesion**: {Inject CC Rubric Text}
> - **Lexical Resource**: {Inject LR Rubric Text}
> - **Grammatical Range & Accuracy**: {Inject GRA Rubric Text}
>
> **Task**:
> Question: "{question_text}"
> Essay: "{essay_body}"
>
> **Output Requirement**:
> Provide the result STRICTLY in the following JSON format. Do not include markdown formatting.

## 4. Response JSON Schema

The LLM MUST return data conforming to this schema.

```json
{
  "TR": {
    "band": 6.5,
    "strengths": ["Clear position throughout the response"],
    "weaknesses": ["Some ideas are not fully developed"]
  },
  "CC": {
    "band": 7.0,
    "strengths": ["Logical paragraphing"],
    "weaknesses": ["Overuse of cohesive devices"]
  },
  "LR": {
    "band": 6.0,
    "strengths": ["Adequate vocabulary for the task"],
    "weaknesses": ["Occasional spelling errors"]
  },
  "GRA": {
    "band": 6.0,
    "strengths": ["Mix of simple and complex sentences"],
    "weaknesses": ["Frequent punctuation errors"]
  },
  "overall_band": 6.5,
  "improvement_tips": [
    "Vary your sentence beginnings to improve flow.",
    "Check for subject-verb agreement in complex sentences."
  ],
  "corrected_sentences": [
    {
      "original": "The data shows that people goes to...",
      "correction": "The data shows that people go to...",
      "explanation": "Subject-verb agreement error."
    }
  ],
  "estimated_word_band": 7.0
}
```

## 5. Reliability & Fallback

### Retry Logic
- **Timeout**: 30 seconds.
- **Max Retries**: 2 (Total 3 attempts).
- **Backoff**: Exponential (1s, 2s).

### Fallback Mechanism
If the LLM returns malformed JSON or fails after retries:
1. **Status Code**: Return `502 Bad Gateway`.
2. **Action**:
   - Store the `raw_response` (if any) in a dead-letter queue or log.
   - Flag the essay status as `manual_review_required`.
   - Return a user-friendly error: "Our examiners are taking a bit longer. Your result will appear shortly."

## 6. Token Usage Estimation
- **Input**: ~1000 tokens (Rubric + Essay).
- **Output**: ~500 tokens (JSON feedback).
- **Cost**: Estimated $0.03 per evaluation (depending on model provider).

## 7. Checksum
- **Endpoints**: 1
- **Schema Complexity**: High (Nested JSON objects)
- **Critical Failure**: Malformed JSON
