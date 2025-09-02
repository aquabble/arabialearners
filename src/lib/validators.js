import { z } from 'zod';

export const ChatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string().min(1)
    })
  ).min(1).max(50)
});

export const GradeSchema = z.object({
  prompt: z.string().min(1),
  answer: z.string().min(1),
  rubric: z.string().default('Accuracy, fluency, and appropriate register.'),
});