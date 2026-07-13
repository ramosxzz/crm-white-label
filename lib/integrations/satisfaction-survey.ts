import { createClient } from "@supabase/supabase-js";

export interface SatisfactionSurvey {
  id: number | string;
  npsScore: number;
  productQuality: string | null;
  serviceRating: string | null;
  deliveryRating: string | null;
  purchaseEase: string | null;
  comments: string | null;
  boutiqueName: string | null;
  createdAt: string;
}

export async function fetchSatisfactionSurveys(): Promise<SatisfactionSurvey[]> {
  const url = process.env.SURVEY_SUPABASE_URL;
  const key = process.env.SURVEY_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  const client = createClient(url, key);
  const { data, error } = await client
    .from("SatisfactionSurvey")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(200);

  if (error || !data) return [];
  return data as SatisfactionSurvey[];
}
