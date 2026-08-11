import type { Metadata } from "next";
import { getAppBaseUrl } from "@/lib/app-url";

export const metadata: Metadata = {
  title: "Política de Privacidade | Solaire W+ CRM",
  description: "Política de privacidade da plataforma Solaire W+ CRM.",
};

const UPDATED_AT = "11 de agosto de 2026";
const CONTACT_EMAIL = "solairew3@gmail.com";
const APP_NAME = "Solaire W+ CRM";

export default async function PrivacyPage() {
  const appUrl = await getAppBaseUrl();

  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>Política de Privacidade</h1>
      <p className="text-muted-foreground text-sm">Última atualização: {UPDATED_AT}</p>

      <p>
        Esta Política de Privacidade descreve como o <strong>{APP_NAME}</strong> (&quot;nós&quot;,
        &quot;nosso&quot; ou &quot;Plataforma&quot;), disponível em{" "}
        <a href={appUrl}>{appUrl}</a>, coleta, usa, armazena e protege as informações dos
        usuários e dos leads gerenciados por meio de nossa plataforma.
      </p>

      <hr />

      <h2>1. Quem somos</h2>
      <p>
        O {APP_NAME} é oferecido pela <strong>WEBSTER E HOPPE LTDA</strong>, inscrita no CNPJ sob
        o nº <strong>54.488.348/0001-07</strong>. A plataforma é um serviço SaaS (Software como
        Serviço) de CRM white-label que permite a empresas gerenciar leads, conversas e automações
        de atendimento. Cada empresa que se cadastra na plataforma é controladora dos dados de
        seus próprios clientes e responsável pelos dados que insere e coleta por meio de suas
        integrações. A plataforma atua como operadora desses dados para prestar o serviço
        contratado.
      </p>
      <p>
        Contato do responsável pela plataforma:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>

      <h2>2. Dados que coletamos</h2>

      <h3>2.1 Dados dos usuários da plataforma (empresas e colaboradores)</h3>
      <ul>
        <li>Nome e endereço de e-mail (fornecidos no cadastro)</li>
        <li>Senha (armazenada de forma criptografada via Supabase Auth)</li>
        <li>Informações da empresa (nome, configurações do workspace)</li>
        <li>Registros de acesso e atividade na plataforma</li>
      </ul>

      <h3>2.2 Dados de leads gerenciados pelas empresas</h3>
      <ul>
        <li>Nome, telefone, e-mail e outros dados inseridos manualmente</li>
        <li>Mensagens de conversas via WhatsApp ou Instagram DM</li>
        <li>Histórico de interações, anotações e status no funil de vendas</li>
        <li>Identificadores de redes sociais (como ID do Instagram)</li>
      </ul>

      <h3>2.3 Dados coletados automaticamente</h3>
      <ul>
        <li>Endereço IP e dados técnicos da conexão</li>
        <li>Logs de requisições para fins de segurança e diagnóstico</li>
        <li>Cookies de sessão necessários para o funcionamento do sistema</li>
      </ul>

      <h2>3. Integrações com a Meta (WhatsApp Business e Instagram)</h2>
      <p>
        A plataforma permite que uma empresa conecte contas e números que administra na Meta.
        A conexão só ocorre após autorização expressa do administrador da conta pelo fluxo oficial
        de Cadastro Incorporado ou login da Meta.
      </p>
      <ul>
        <li>
          No WhatsApp Business, usamos <code>whatsapp_business_management</code> para identificar
          e configurar a WABA e os números escolhidos, registrar o número, assinar webhooks e
          consultar informações e modelos pertencentes à conta conectada.
        </li>
        <li>
          Usamos <code>whatsapp_business_messaging</code> para enviar e receber mensagens em nome
          da empresa autorizada, processar mídia compatível e acompanhar estados de envio, entrega
          e leitura. Fora da janela de atendimento, o envio depende de modelo aprovado pela Meta.
        </li>
        <li>
          Na integração com Instagram, quando habilitada, usamos as permissões aprovadas no app
          para receber e responder mensagens e associá-las ao lead correto.
        </li>
        <li>
          Identificadores de conta, tokens de acesso e mensagens ficam disponíveis apenas no
          servidor e para os usuários autorizados da empresa correspondente, com isolamento por
          tenant.
        </li>
        <li>
          <strong>Não vendemos Dados da Plataforma da Meta nem os utilizamos para publicidade não
          relacionada.</strong> Esses dados são tratados somente para oferecer as funcionalidades
          solicitadas pela empresa que conectou a conta.
        </li>
        <li>
          Cada empresa é responsável por obter o consentimento adequado de seus contatos conforme
          as políticas da Meta e a legislação aplicável.
        </li>
      </ul>
      <p>
        Para desconectar uma integração e solicitar a exclusão dos Dados da Plataforma da Meta,
        consulte as instruções em <a href={`${appUrl}/data-deletion`}>{appUrl}/data-deletion</a>
        {" "}ou escreva para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>4. Como usamos as informações</h2>
      <ul>
        <li>Fornecer e manter os serviços da plataforma</li>
        <li>Autenticar usuários e proteger contas</li>
        <li>Processar mensagens recebidas via integrações e criar leads automaticamente</li>
        <li>Enviar notificações relacionadas ao serviço (sem fins de marketing, a não ser que você opte por isso)</li>
        <li>Diagnosticar problemas técnicos e melhorar a plataforma</li>
        <li>Cumprir obrigações legais</li>
      </ul>

      <h2>5. Compartilhamento de dados</h2>
      <p>
        Não vendemos seus dados a terceiros. Podemos compartilhar informações apenas nas seguintes
        situações:
      </p>
      <ul>
        <li>
          <strong>Provedores de infraestrutura:</strong> Supabase (banco de dados, autenticação e
          armazenamento), Cloudflare (rede, DNS e serviços de mídia, quando habilitados) e
          Hostinger International Ltd. (hospedagem da infraestrutura de aplicação), que atuam
          como operadores de dados para a prestação do serviço.
        </li>
        <li>
          <strong>Meta Platforms:</strong> para troca de tokens e recebimento de mensagens via
          API, conforme as Políticas de Plataforma da Meta.
        </li>
        <li>
          <strong>Determinação legal:</strong> quando exigido por lei, ordem judicial ou
          autoridade competente.
        </li>
      </ul>

      <h2>6. Retenção de dados</h2>
      <p>
        Os dados são retidos enquanto a conta da empresa estiver ativa. Após o encerramento da
        conta, os dados são excluídos em até <strong>90 dias</strong>, salvo obrigação legal de
        retenção por período maior.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados, incluindo:
        criptografia em trânsito (HTTPS/TLS), criptografia de senhas, isolamento de dados por
        tenant via Row-Level Security (RLS) no banco de dados, e controle de acesso por
        autenticação.
      </p>

      <h2>8. Seus direitos (LGPD)</h2>
      <p>
        Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:
      </p>
      <ul>
        <li>Confirmar a existência de tratamento dos seus dados</li>
        <li>Acessar, corrigir ou atualizar seus dados</li>
        <li>Solicitar a exclusão dos seus dados</li>
        <li>Revogar consentimentos fornecidos</li>
        <li>Portabilidade dos dados, quando aplicável</li>
      </ul>
      <p>
        Para exercer qualquer um desses direitos, entre em contato pelo e-mail{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>9. Cookies</h2>
      <p>
        Utilizamos apenas cookies estritamente necessários para manter a sessão de usuários
        autenticados. Não utilizamos cookies de rastreamento ou publicidade.
      </p>

      <h2>10. Menores de idade</h2>
      <p>
        Nossa plataforma é destinada exclusivamente a empresas e profissionais maiores de 18 anos.
        Não coletamos intencionalmente dados de menores.
      </p>

      <h2>11. Alterações nesta política</h2>
      <p>
        Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre
        alterações significativas por e-mail ou via aviso na plataforma. O uso continuado dos
        serviços após as alterações constitui aceitação da política atualizada.
      </p>

      <h2>12. Contato</h2>
      <p>
        Em caso de dúvidas, solicitações ou reclamações relacionadas a esta Política de
        Privacidade, entre em contato:
      </p>
      <ul>
        <li>
          <strong>E-mail:</strong>{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </li>
        <li>
          <strong>Plataforma:</strong> <a href={appUrl}>{appUrl}</a>
        </li>
      </ul>
    </article>
  );
}
