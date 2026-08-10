import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill } from "remotion";
import { Fragment } from "react";
import { FeatureScene } from "./scenes/FeatureScene";
import { IntroScene } from "./scenes/IntroScene";
import { OutroScene } from "./scenes/OutroScene";

const transition = linearTiming({ durationInFrames: 21 });

const features = [
  {
    image: "showcase/conversas.png",
    eyebrow: "Atendimento conectado",
    title: "Toda conversa com o contexto certo.",
    description: "WhatsApp, histórico, notas e próximos passos reunidos para sua equipe atender melhor.",
    accent: "#22D3EE",
    index: "01",
  },
  {
    image: "showcase/kanban.png",
    eyebrow: "Pipeline comercial",
    title: "Cada oportunidade no lugar certo.",
    description: "Funis personalizáveis mostram o que avançou, o que precisa de atenção e o que virou venda.",
    accent: "#60A5FA",
    index: "02",
  },
  {
    image: "showcase/dashboard.png",
    eyebrow: "Gestão em tempo real",
    title: "Decisões melhores começam com clareza.",
    description: "Acompanhe operação, metas, origens e desempenho em uma visão simples de usar todos os dias.",
    accent: "#818CF8",
    index: "03",
  },
  {
    image: "showcase/agenda.png",
    eyebrow: "Agenda integrada",
    title: "O próximo passo nunca fica para trás.",
    description: "Agenda, tarefas, reuniões e lembretes conectados ao histórico de cada cliente.",
    accent: "#2DD4BF",
    index: "04",
  },
] as const;

export const ProductVideo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#05070c" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={120}>
          <IntroScene />
        </TransitionSeries.Sequence>

        {features.map((feature) => (
          <Fragment key={feature.image}>
            <TransitionSeries.Transition presentation={fade()} timing={transition} />
            <TransitionSeries.Sequence durationInFrames={105}>
              <FeatureScene {...feature} />
            </TransitionSeries.Sequence>
          </Fragment>
        ))}

        <TransitionSeries.Transition presentation={fade()} timing={transition} />
        <TransitionSeries.Sequence durationInFrames={105}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
