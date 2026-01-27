
// Paste formatEvaluation code here
function formatEvaluation(raw, essayBody) {
  const safeObj = (val) => (typeof val === 'object' && val !== null ? val : {});
  const safeNum = (val, fallback = 0) => (typeof val === 'number' && !isNaN(val) ? val : fallback);
  const safeStr = (val, fallback = '') => (typeof val === 'string' ? val : fallback);
  
  const data = safeObj(raw);

  const expectedSubItems = {
    taskResponse: ['item1', 'item2', 'item3', 'item4'], 
    coherenceCohesion: ['item1', 'item2', 'item3', 'item4'], 
    lexicalResource: ['item1', 'item2', 'item3', 'item4'], 
    grammaticalRangeAccuracy: ['item1', 'item2', 'item3', 'item4'], 
  };

  const getDimension = (rawDim, dimKey, overall) => {
    const subItems = {};
    const safeDim = safeObj(rawDim);
    const subItemsRaw = safeObj(safeDim.subItems || safeDim.sub_scores);
    
    // Determine keys: prefer actual keys from AI response, fallback to expected defaults
    const actualKeys = Object.keys(subItemsRaw);
    const defaultKeys = expectedSubItems[dimKey] || ['item1', 'item2', 'item3', 'item4'];
    const keysToUse = actualKeys.length > 0 ? actualKeys : defaultKeys;

    keysToUse.forEach(key => {
      let item = subItemsRaw[key];
      subItems[key] = {
        score: safeNum(item?.score, overall), // 找不到时才用 overall
        reason: safeStr(item?.reason, '暂无评价'),
        label: safeStr(item?.label, key) // 关键：必须捕获 AI 返回的动态 label
      };
    });

    return {
      score: safeNum(safeDim.score ?? safeDim.band, overall),
      reason: safeStr(safeDim.reason ?? safeDim.explanation ?? safeDim.feedback ?? safeDim.comment, '评分完成'),
      label: safeDim.label ? safeStr(safeDim.label) : undefined,
      subItems
    };
  };

  const overall = safeNum(data.overallScore ?? data.overall_band, 5.0);

  return {
    topic: safeStr(data.topic ?? data.title ?? 'Unknown Topic'),
    overallScore: overall,
    dimensions: {
      taskResponse: getDimension(data.dimensions?.taskResponse ?? data.TR, 'taskResponse', overall),
      coherenceCohesion: getDimension(data.dimensions?.coherenceCohesion ?? data.CC, 'coherenceCohesion', overall),
      // ... others omitted for brevity
    }
  };
}

const mockAiResponse = {
  "topic": "Some people think that technology is making people less social. To what extent do you agree or disagree?",
  "overallScore": 6.5,
  "dimensions": {
    "taskResponse": {
      "score": 6.0,
      "label": "Task Response",
      "reason": "...",
      "subItems": {
        "item1": { "label": "Response to Prompt", "score": 6, "reason": "..." },
        "item2": { "label": "Position Clarity", "score": 7, "reason": "..." },
        "item3": { "label": "Idea Development & Support", "score": 5, "reason": "..." },
        "item4": { "label": "Logic & Generalisation", "score": 6, "reason": "..." }
      }
    },
    "coherenceCohesion": {
      "score": 6.0,
      "subItems": {
        "item1": { "label": "Logical Sequencing", "score": 6, "reason": "..." }
      }
    }
  }
};

const result = formatEvaluation(mockAiResponse);
console.log("TR SubItems:", JSON.stringify(result.dimensions.taskResponse.subItems, null, 2));
