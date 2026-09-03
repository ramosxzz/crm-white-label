"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cepDigits, formatCep, lookupCep } from "@/lib/address/cep";

export type ServiceOrderAddress = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

const EMPTY: ServiceOrderAddress = {
  cep: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
};

type LookupStatus = "idle" | "loading" | "filled" | "not_found" | "failed";

const STATUS_MESSAGE: Record<Exclude<LookupStatus, "idle" | "loading">, string> = {
  filled: "Endereço preenchido pelo CEP — confira o número.",
  not_found: "CEP não encontrado. Preencha o endereço na mão.",
  failed: "Não deu pra consultar o CEP agora. Preencha o endereço na mão.",
};

/**
 * Endereco do atendimento com busca por CEP. O CEP vem primeiro de proposito:
 * digitou os 8 digitos, rua/bairro/cidade/UF chegam sozinhos e o foco pula pro
 * numero, que e o unico campo que o CEP nao sabe.
 */
export function ServiceOrderAddressFields({
  defaultValue,
  disabled = false,
}: {
  defaultValue?: Partial<ServiceOrderAddress>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<ServiceOrderAddress>({ ...EMPTY, ...defaultValue });
  const [status, setStatus] = useState<LookupStatus>("idle");
  // Cada digitacao invalida a consulta anterior: so a ultima pode preencher o
  // formulario, senao uma resposta lenta sobrescreve o CEP novo.
  const requestRef = useRef(0);
  const numberRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof ServiceOrderAddress>(key: K, next: string) {
    setValue((prev) => ({ ...prev, [key]: next }));
  }

  async function onCepChange(raw: string) {
    const formatted = formatCep(raw);
    setValue((prev) => ({ ...prev, cep: formatted }));

    if (cepDigits(formatted).length !== 8) {
      setStatus("idle");
      return;
    }

    const requestId = ++requestRef.current;
    setStatus("loading");
    try {
      const found = await lookupCep(formatted);
      if (requestRef.current !== requestId) return;
      if (!found) {
        setStatus("not_found");
        return;
      }
      // Cidade com CEP unico volta sem logradouro/bairro: nesse caso o que o
      // usuario ja tinha digitado vale mais que o vazio da API.
      setValue((prev) => ({
        ...prev,
        street: found.street || prev.street,
        district: found.district || prev.district,
        city: found.city || prev.city,
        state: found.state || prev.state,
      }));
      setStatus("filled");
      numberRef.current?.focus();
    } catch {
      if (requestRef.current !== requestId) return;
      setStatus("failed");
    }
  }

  return (
    <fieldset className="space-y-3 rounded-lg border border-border/70 p-3" disabled={disabled}>
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Endereço do atendimento
      </legend>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="address_cep">CEP</Label>
          <div className="relative">
            <Input
              id="address_cep"
              name="address_cep"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="93220-640"
              value={value.cep}
              onChange={(e) => onCepChange(e.target.value)}
              className={status === "loading" ? "pr-9" : undefined}
            />
            {status === "loading" && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="address_street">Rua</Label>
          <Input
            id="address_street"
            name="address_street"
            value={value.street}
            onChange={(e) => set("street", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="address_number">Número</Label>
          <Input
            id="address_number"
            name="address_number"
            ref={numberRef}
            value={value.number}
            onChange={(e) => set("number", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address_complement">Complemento</Label>
          <Input
            id="address_complement"
            name="address_complement"
            placeholder="Apto 401"
            value={value.complement}
            onChange={(e) => set("complement", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address_district">Bairro</Label>
          <Input
            id="address_district"
            name="address_district"
            value={value.district}
            onChange={(e) => set("district", e.target.value)}
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="address_city">Cidade</Label>
          <Input
            id="address_city"
            name="address_city"
            value={value.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="address_state">UF</Label>
          <Input
            id="address_state"
            name="address_state"
            maxLength={2}
            placeholder="RS"
            value={value.state}
            onChange={(e) => set("state", e.target.value.toUpperCase())}
          />
        </div>
      </div>

      {status !== "idle" && status !== "loading" && (
        <p
          className={
            status === "filled"
              ? "text-xs text-muted-foreground"
              : "text-xs text-amber-600 dark:text-amber-400"
          }
        >
          {STATUS_MESSAGE[status]}
        </p>
      )}
    </fieldset>
  );
}
