import { request, sessionContext } from '@/api/client';
import type { GenerateQuizRequestDto, QuizResponseDto } from '@/types/api';
import type { QuizPort } from '@/services/ports';
import type { Quiz, QuizGenerationStatus } from '@/types/domain';
import { isoToFR } from '@/utils/format';

const STATUS_FROM_API: Record<string, QuizGenerationStatus> = {
  PENDING: 'en_cours',
  READY: 'prete',
  FAILED: 'echouee',
};

function fromQuizResponse(dto: QuizResponseDto): Quiz {
  return {
    id: dto.id,
    titre: dto.title,
    classe: dto.classId,
    matiere: dto.subjectName,
    nombreQuestions: dto.questionCount,
    questions: dto.questions.map((q) => ({
      index: q.index,
      question: q.question,
      options: q.options,
      bonneReponseIndex: q.correctOptionIndex,
      explication: q.explanation,
    })),
    publie: dto.published,
    statut: STATUS_FROM_API[dto.generationStatus] ?? 'en_cours',
    motifEchec: dto.failureReason,
    nombreTentatives: dto.attemptCount,
    creeLe: isoToFR(dto.createdAt.slice(0, 10)),
  };
}

/** Quiz de révision générés par IA — `ai-service`, `/api/v1/ai/quiz`. */
export function createQuizApi(): QuizPort {
  return {
    async mine(): Promise<Quiz[]> {
      const dtos = await request<QuizResponseDto[]>('/api/v1/ai/quiz/mine');
      return dtos.map(fromQuizResponse);
    },

    async generate(input): Promise<Quiz> {
      const { schoolId } = sessionContext();
      const body: GenerateQuizRequestDto = {
        schoolId,
        subjectName: input.matiere,
        classId: input.classId,
        subjectId: input.subjectId,
        courseText: input.texteCours,
        topic: input.sujet,
        questionCount: input.nombreQuestions,
        language: 'fr',
      };
      const dto = await request<QuizResponseDto>('/api/v1/ai/quiz/generate', { method: 'POST', body });
      return fromQuizResponse(dto);
    },

    async publish(quizId): Promise<Quiz> {
      const dto = await request<QuizResponseDto>(`/api/v1/ai/quiz/${encodeURIComponent(quizId)}/publish`, {
        method: 'PUT',
      });
      return fromQuizResponse(dto);
    },

    async unpublish(quizId): Promise<Quiz> {
      const dto = await request<QuizResponseDto>(`/api/v1/ai/quiz/${encodeURIComponent(quizId)}/unpublish`, {
        method: 'PUT',
      });
      return fromQuizResponse(dto);
    },

    async remove(quizId): Promise<void> {
      await request<void>(`/api/v1/ai/quiz/${encodeURIComponent(quizId)}`, { method: 'DELETE' });
    },
  };
}
