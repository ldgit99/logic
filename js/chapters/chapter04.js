import { renderChapterWith } from './chapterBase.js?v=20260309d';
import { mountGateSimulator } from '../simulations/gateSimulator.js';
import { mountTimingDiagram } from '../simulations/timingDiagram.js';
import { mountElectricalProps } from '../simulations/electricalProps.js';

const SIM_MOUNTS = {
  gateSimulator:  mountGateSimulator,
  timingDiagram:  mountTimingDiagram,
  electricalProps: mountElectricalProps,
};

export async function renderChapter(data) {
  return renderChapterWith(data, SIM_MOUNTS);
}
