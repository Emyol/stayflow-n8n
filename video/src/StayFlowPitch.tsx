import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, Sequence, staticFile } from "remotion";
import { Cases } from "./scenes/Cases";
import { Close } from "./scenes/Close";
import { Hook } from "./scenes/Hook";
import { Pipeline } from "./scenes/Pipeline";
import { Problem } from "./scenes/Problem";
import { Results } from "./scenes/Results";
import { Reveal } from "./scenes/Reveal";

// Scene lengths are sized to their voiceover lines. 1890 frames of scenes
// minus 6 × 15-frame transitions = 1800 frames (60 s at 30 fps).
// Scene starts on the main timeline: 0, 180, 415, 583, 903, 1350, 1580.
const VOICEOVER = [
  { file: "vo/01-hook.mp3", from: 8 },
  { file: "vo/02-problem.mp3", from: 186 },
  { file: "vo/03-reveal.mp3", from: 425 },
  { file: "vo/04-pipeline.mp3", from: 595 },
  { file: "vo/05a-case101.mp3", from: 909 },
  { file: "vo/05b-case102.mp3", from: 1039 },
  { file: "vo/05c-case106.mp3", from: 1211 },
  { file: "vo/06-results.mp3", from: 1368 },
  { file: "vo/07-close.mp3", from: 1592 },
];

export const StayFlowPitch: React.FC = () => (
  <AbsoluteFill>
    <TransitionSeries>
      <TransitionSeries.Sequence name="Hook" durationInFrames={195}>
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
      <TransitionSeries.Sequence name="Problem" durationInFrames={250}>
        <Problem />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
      <TransitionSeries.Sequence name="Reveal" durationInFrames={183}>
        <Reveal />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />
      <TransitionSeries.Sequence name="Pipeline" durationInFrames={335}>
        <Pipeline />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />
      <TransitionSeries.Sequence name="Cases" durationInFrames={462}>
        <Cases />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
      <TransitionSeries.Sequence name="Results" durationInFrames={245}>
        <Results />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />
      <TransitionSeries.Sequence name="Close" durationInFrames={220}>
        <Close />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {VOICEOVER.map((line) => (
      <Sequence key={line.file} name={line.file} from={line.from} layout="none">
        <Audio src={staticFile(line.file)} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
