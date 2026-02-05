'use client';

import { useEffect } from 'react';
import { useEvaluation } from '@/lib/context/evaluation-context';

export default function EvaluationCleanup({ evaluationId }: { evaluationId: string }) {
  const { resetEvaluation, evaluationId: currentId } = useEvaluation();

  useEffect(() => {
    // Only reset if the current context ID matches the ID of the report being viewed.
    // This confirms the user has successfully navigated to the result of *this* evaluation session.
    if (currentId === evaluationId) {
        // Reset immediately on mount to clear "Evaluation Complete" status from sidebar
        resetEvaluation();
    }
  }, [currentId, evaluationId, resetEvaluation]);

  return null; // This component renders nothing
}
