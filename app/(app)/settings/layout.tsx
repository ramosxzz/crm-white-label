import { PageHeader } from "@/components/app/page-header";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Personalize a identidade da sua empresa no CRM"
      />
      {children}
    </div>
  );
}
