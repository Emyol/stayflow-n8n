import { Composition, Folder } from "remotion";
import { Cases } from "./scenes/Cases";
import { Close } from "./scenes/Close";
import { Hook } from "./scenes/Hook";
import { Pipeline } from "./scenes/Pipeline";
import { Problem } from "./scenes/Problem";
import { Results } from "./scenes/Results";
import { Reveal } from "./scenes/Reveal";
import { StayFlowPitch } from "./StayFlowPitch";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="StayFlowPitch" component={StayFlowPitch} width={1920} height={1080} fps={30} durationInFrames={1800} />
      <Folder name="StayFlowPitch-Scenes">
        <Composition id="Hook" component={Hook} width={1920} height={1080} fps={30} durationInFrames={195} />
        <Composition id="Problem" component={Problem} width={1920} height={1080} fps={30} durationInFrames={250} />
        <Composition id="Reveal" component={Reveal} width={1920} height={1080} fps={30} durationInFrames={183} />
        <Composition id="Pipeline" component={Pipeline} width={1920} height={1080} fps={30} durationInFrames={335} />
        <Composition id="Cases" component={Cases} width={1920} height={1080} fps={30} durationInFrames={462} />
        <Composition id="Results" component={Results} width={1920} height={1080} fps={30} durationInFrames={245} />
        <Composition id="Close" component={Close} width={1920} height={1080} fps={30} durationInFrames={220} />
      </Folder>
    </>
  );
};
