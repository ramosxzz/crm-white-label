import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/server";
import { TenantTheme } from "@/components/app/tenant-theme";
import { SurveyForm } from "./survey-form";

export const dynamic = "force-dynamic";

async function getForm(slug: string) {
  const supabase = createServiceClient();
  const { data: form } = await supabase
    .from("satisfaction_survey_forms")
    .select("slug, title, subtitle, employees, is_active, tenant_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!form || !form.is_active) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, logo_url, brand_color")
    .eq("id", form.tenant_id)
    .maybeSingle();

  return { form, tenant };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getForm(slug);
  return { title: data?.form.title ?? "Pesquisa de Satisfação" };
}

export default async function SurveyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getForm(slug);
  if (!data) notFound();

  const { form, tenant } = data;
  const employees = (form.employees as string[] | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <TenantTheme brandColor={tenant?.brand_color ?? null} />
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {tenant?.logo_url && (
            <Image
              src={tenant.logo_url}
              alt={tenant.name}
              width={72}
              height={72}
              className="rounded-xl object-contain"
              unoptimized
            />
          )}
          <h1 className="font-display text-xl font-bold">{form.title}</h1>
          {form.subtitle && <p className="text-sm text-muted-foreground">{form.subtitle}</p>}
        </div>

        <SurveyForm slug={slug} employees={employees} />

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Nunca enviamos senhas ou dados de pagamento por este formulário.
        </p>
      </div>
    </div>
  );
}
