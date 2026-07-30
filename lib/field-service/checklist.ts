export const SERVICE_REPORT_CHECKLIST = [
  { key: "duplo_aspecto_cores", label: "O tecido possui duplo aspecto de cores?" },
  {
    key: "ciente_umidade",
    label: "Cliente ciente de que o tecido pode umedecer, mas não irá manchar?",
  },
  { key: "manchas_superficiais", label: "A peça está com manchas superficiais?" },
  { key: "ciente_manutencao", label: "Cliente ciente sobre como fazer manutenção?" },
  { key: "acumulo_po", label: "A peça contém acúmulo de pó?" },
  { key: "piso_laminado", label: "O piso do cliente é laminado?" },
  { key: "fio_puxado", label: "A peça está com fio puxado?" },
  { key: "queimada", label: "A peça está queimada?" },
  { key: "rasgada", label: "A peça está rasgada?" },
  { key: "acumulo_cola", label: "A peça está com acúmulo de cola?" },
  { key: "desgaste_sol", label: "A peça está com desgaste de sol?" },
  { key: "mancha_batom", label: "A peça está com mancha de batom?" },
  { key: "mancha_caneta", label: "A peça está com mancha de caneta?" },
  { key: "mancha_graxa", label: "A peça está com mancha de graxa?" },
  { key: "mancha_alvejante", label: "A peça está com mancha de alvejante?" },
  { key: "mofo", label: "A peça está com mofo?" },
] as const;

export type ServiceReportChecklistKey = (typeof SERVICE_REPORT_CHECKLIST)[number]["key"];
