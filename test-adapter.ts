
import { formatEvaluation } from './src/lib/score-adapter';

// Mock input matching ielts-rubric.ts definition
const mockAiResponse = {
  "topic": "The essay topic",
  "questionAnalysis": "Analysis...",
  "taskType": 1, 
  "overallScore": 6.5,
  "dimensions": {
    "taskResponse": {
      "score": 6.0,
      "label": "Task Achievement", 
      "reason": "Overall feedback...",
      "subItems": {
        "item1": { "label": "Overview Clarity", "score": 6, "reason": "Feedback..." },
        "item2": { "label": "Key Features", "score": 6, "reason": "Feedback..." }
      }
    },
    "coherenceCohesion": {
        "score": 7.0,
        "subItems": {
            "logicalSequencing": { "label": "Logical Sequencing", "score": 7, "reason": "..." }
        }
    }
  }
};

const result = formatEvaluation(mockAiResponse);

console.log("Task Response SubItems:", JSON.stringify(result.dimensions.taskResponse.subItems, null, 2));
console.log("CC SubItems:", JSON.stringify(result.dimensions.coherenceCohesion.subItems, null, 2));

if (result.dimensions.taskResponse.subItems.item1.label === "Overview Clarity") {
    console.log("SUCCESS: item1 label captured");
} else {
    console.log("FAIL: item1 label NOT captured. Got:", result.dimensions.taskResponse.subItems.item1.label);
}

if (result.dimensions.coherenceCohesion.subItems.logicalSequencing?.label === "Logical Sequencing") {
    console.log("SUCCESS: dynamic key label captured");
} else {
    console.log("FAIL: dynamic key label NOT captured");
}
