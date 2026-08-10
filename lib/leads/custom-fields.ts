export type Definition = {
  key: string;
  field_type: "text" | "number" | "date" | "select" | "boolean" | "file";
  is_required: boolean;
};

export function normalizeCustomFieldValues(
  definitions: Definition[],
  values: Record<string, unknown>,
) {
  // Anotacao explicita de retorno: sem ela, os 3 branches (number/boolean/
  // string) formam uma uniao de tuplas heterogeneas que o TS nao consegue
  // encaixar no overload de flatMap (quer um shape de tupla so).
  return Object.fromEntries(definitions.flatMap((definition): [string, unknown][] => {
    const raw = values[definition.key];
    if ((raw === undefined || raw === null || raw === "") && definition.is_required) {
      throw new Error(`Campo obrigatorio: ${definition.key}`);
    }
    if (raw === undefined || raw === null || raw === "") return [];
    if (definition.field_type === "number") {
      const number = Number(raw);
      if (!Number.isFinite(number)) throw new Error(`Numero invalido: ${definition.key}`);
      return [[definition.key, number]];
    }
    if (definition.field_type === "boolean") return [[definition.key, raw === true || raw === "true"]];
    return [[definition.key, String(raw)]];
  }));
}
