import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { parseAIMentorInsightResponse, type AIMentorInsightResponse } from '../lib/aiMentorOutput'

export interface AIMentorInsightService {
  generateMentorInsight(studentId: string): Promise<AIMentorInsightResponse>
}

export class SupabaseEdgeAIMentorInsightService implements AIMentorInsightService {
  async generateMentorInsight(studentId: string) {
    if (!studentId) throw new Error('Öğrenci seçilmedi.')
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase yapılandırılmamış. .env dosyanızı kontrol edin.')
    }

    const { data, error } = await supabase.functions.invoke('mentor-ai-insight', {
      body: { studentId },
    })
    if (error) throw new Error(error.message || 'AI mentor servisine ulaşılamadı.')
    return parseAIMentorInsightResponse(data)
  }
}

export const aiMentorInsightService: AIMentorInsightService = new SupabaseEdgeAIMentorInsightService()
