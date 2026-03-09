import { renderChapterWith } from './chapterBase.js?v=20260309d';
import { mountAnalogDigital } from '../simulations/analogDigital.js';
import { mountPulseWave } from '../simulations/pulseWave.js';
import { mountAdcSampling } from '../simulations/adcSampling.js';
import { mountUnitConverter } from '../simulations/unitConverter.js';
import { mountNpnTransistorLabDraft } from '../simulations/npnTransistorLab.draft.js';

const SIM_MOUNTS = {
  analogDigital: mountAnalogDigital,
  pulseWave: mountPulseWave,
  adcSampling: mountAdcSampling,
  unitConverter: mountUnitConverter,
  npnTransistorLabDraft: mountNpnTransistorLabDraft,
};

export async function renderChapter(data) {
  return renderChapterWith(data, SIM_MOUNTS);
}
