import type { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/app-url";

export const metadata: Metadata = {
  title: "Termos de Uso | Solaire W+ CRM",
  description: "Termos de uso da plataforma Solaire W+ CRM.",
};

const UPDATED_AT = "11 de agosto de 2026";
const CONTACT_EMAIL = "solairew3@gmail.com";
const APP_NAME = "Solaire W+ CRM";

export default async function TermsPage() {
  const appUrl = await getAppBaseUrl();

  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>Termos de Uso</h1>
      <p className="text-muted-foreground text-sm">Última atualização: {UPDATED_AT}</p>

      <p>
        Ao se cadastrar e utilizar o <strong>{APP_NAME}</strong>, disponível em{" "}
        <a href={appUrl}>{appUrl}</a>, você concorda com os presentes Termos de Uso. Leia-os
        atentamente antes de utilizar a plataforma.
      </p>

      <hr />

      <h2>1. Descrição do serviço</h2>
      <p>
        O {APP_NAME} é uma plataforma de CRM (Gestão de Relacionamento com o Cliente) oferecida
        como SaaS (Software como Serviço), que permite a empresas gerenciar leads, funis de
        vendas, conversas via WhatsApp e Instagram, automações de atendimento e integrações com
        canais digitais.
      </p>

      <h2>2. Cadastro e conta</h2>
      <ul>
        <li>
          Para utilizar a plataforma, você deve fornecer informações verdadeiras e manter seus
          dados atualizados.
        </li>
        <li>
          Cada empresa cadastrada possui um workspace isolado. Você é responsável por todas as
          ações realizadas em sua conta.
        </li>
        <li>
          É proibido compartilhar credenciais de acesso com terceiros não autorizados.
        </li>
        <li>
          Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos.
        </li>
      </ul>

      <h2>3. Uso aceitável</h2>
      <p>Você concorda em não utilizar a plataforma para:</p>
      <ul>
        <li>Enviar spam, mensagens não solicitadas em massa ou conteúdo enganoso</li>
        <li>Violar leis aplicáveis, incluindo leis de proteção de dados (LGPD)</li>
        <li>
          Violar as Políticas de Plataforma da Meta ao utilizar as integrações com WhatsApp e
          Instagram
        </li>
        <li>Tentar acessar dados de outros clientes da plataforma</li>
        <li>Realizar engenharia reversa, descompilar ou modificar o software</li>
        <li>Usar a plataforma para fins ilegais ou prejudiciais a terceiros</li>
      </ul>

      <h2>4. Responsabilidade pelos dados</h2>
      <p>
        Você é o controlador dos dados dos seus leads e clientes. O {APP_NAME} atua como
        processador de dados em seu nome. Você é responsável por:
      </p>
      <ul>
        <li>Obter as permissões necessárias para coletar e tratar dados de contatos</li>
        <li>Cumprir a LGPD e demais legislações de proteção de dados aplicáveis</li>
        <li>
          Garantir que o uso das integrações (WhatsApp, Instagram) esteja em conformidade com as
          políticas dos respectivos provedores
        </li>
      </ul>

      <h2>5. Integrações com terceiros</h2>
      <p>
        A plataforma oferece integrações com serviços de terceiros (Meta/Facebook, WhatsApp,
        Instagram, etc.). O uso dessas integrações está sujeito aos termos e políticas dos
        respectivos provedores. O {APP_NAME} não se responsabiliza por alterações, interrupções ou
        descontinuação desses serviços de terceiros.
      </p>

      <h2>6. Disponibilidade do serviço</h2>
      <p>
        Nos esforçamos para manter a plataforma disponível 24/7, mas não garantimos
        disponibilidade ininterrupta. Manutenções programadas serão comunicadas com antecedência
        quando possível.
      </p>

      <h2>7. Propriedade intelectual</h2>
      <p>
        Todo o código, design, marca e conteúdo da plataforma são de propriedade do {APP_NAME}.
        Os dados inseridos por você permanecem de sua propriedade. Ao usar a plataforma, você nos
        concede uma licença limitada para processar esses dados exclusivamente para prestação do
        serviço.
      </p>

      <h2>8. Limitação de responsabilidade</h2>
      <p>
        O {APP_NAME} não se responsabiliza por danos indiretos, incidentais ou consequenciais
        decorrentes do uso ou impossibilidade de uso da plataforma, incluindo perda de dados,
        lucros cessantes ou danos à reputação, na máxima extensão permitida pela lei aplicável.
      </p>

      <h2>9. Alterações nos termos</h2>
      <p>
        Podemos modificar estes Termos periodicamente. Alterações significativas serão comunicadas
        com pelo menos 15 dias de antecedência por e-mail ou aviso na plataforma. O uso continuado
        após as alterações implica aceitação dos novos termos.
      </p>

      <h2>10. Rescisão</h2>
      <p>
        Você pode encerrar sua conta a qualquer momento entrando em contato conosco. Podemos
        encerrar ou suspender seu acesso por violação destes Termos, com ou sem aviso prévio
        dependendo da gravidade da violação.
      </p>

      <h2>11. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis da República Federativa do Brasil. Eventuais litígios
        serão submetidos ao foro da comarca de domicílio do responsável pela plataforma, salvo
        disposição legal em contrário.
      </p>

      <h2>12. Contato</h2>
      <p>
        Para dúvidas sobre estes Termos:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </article>
  );
}
