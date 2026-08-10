import { Composition } from "remotion";
import { ProductVideo } from "./ProductVideo";

export const MyComposition = () => {
  return (
    <Composition
      id="SolaireCRMOverview"
      component={ProductVideo}
      durationInFrames={540}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
