export type CallOutcome = "feita" | "sem_resposta" | "passou_valor" | "qualificado" | "fechado" | "perdido";

export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  feita: "Ligação feita",
  sem_resposta: "Sem resposta",
  passou_valor: "Passou valor",
  qualificado: "Qualificado",
  fechado: "Fechado",
  perdido: "Perdido",
};
