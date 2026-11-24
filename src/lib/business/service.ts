import { createClient } from '@/lib/supabase/server';
import { getEmbeddingProvider } from '@/lib/ai/embeddings';
import { BusinessProfileSchema, type BusinessProfile } from './types';

/**
 * Service to save or update a business profile and compute its 1536-dim embedding.
 */
export async function saveBusinessProfile(
  ownerId: string,
  profileData: Partial<BusinessProfile>
): Promise<BusinessProfile> {
  const supabase = await createClient();
  const embeddings = getEmbeddingProvider();

  const validated = BusinessProfileSchema.parse({
    ...profileData,
    owner_id: ownerId,
  });

  const payload: Database['public']['Tables']['businesses']['Insert'] = {
    id: validated.id,
    owner_id: ownerId,
    name: validated.name,
    state: validated.state,
    gst_status: validated.gst_status,
    turnover_band: validated.turnover_band,
    employee_count: validated.employee_count,
    industry: validated.industry,
    description: validated.description,
    telegram_chat_id: validated.telegram_chat_id,
    updated_at: new Date().toISOString(),
  };

  const { data: business, error } = await supabase
    .from('businesses')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error || !business) {
    throw new Error(`Failed to save business profile: ${error?.message}`);
  }

  // Generate and store embedding for semantic matching
  const textToEmbed = [
    `Business: ${business.name}`,
    `State: ${business.state}`,
    `GST Status: ${business.gst_status}`,
    `Industry: ${business.industry}`,
    `Description: ${business.description || ''}`,
    `Turnover: ${business.turnover_band}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const vector = await embeddings.embedText(textToEmbed);
    await supabase.from('embeddings').upsert(
      {
        owner_type: 'business',
        owner_id: business.id,
        vector,
        model: embeddings.name,
      },
      { onConflict: 'owner_type,owner_id,model' }
    );
  } catch (embedError) {
    console.error('Failed to generate business embedding:', embedError);
  }

  return {
    id: business.id,
    owner_id: business.owner_id,
    name: business.name,
    state: business.state,
    gst_status: business.gst_status,
    turnover_band: business.turnover_band as BusinessProfile['turnover_band'],
    employee_count: business.employee_count,
    industry: business.industry,
    description: business.description || '',
    telegram_chat_id: business.telegram_chat_id,
  };
}
