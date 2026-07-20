export type CallOutcome = "feita" | "sem_resposta" | "passou_valor" | "qualificado" | "fechado" | "perdido";

export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  feita: "Ligação feita",
  sem_resposta: "Sem resposta",
  passou_valor: "Passou valor",
  qualificado: "Qualificado", // legado - mantido so pra exibir registros antigos, nao e mais selecionavel
  fechado: "Fechado",
  perdido: "Perdido",
};

// "Qualificado" virou tag do lead, nao resultado de ligacao - por isso fica
// fora das opcoes selecionaveis no dropdown de resultado.
export const SELECTABLE_CALL_OUTCOMES: CallOutcome[] = ["feita", "sem_resposta", "passou_valor", "fechado", "perdido"];

export const QUALIFIED_TAG = "qualificado";
