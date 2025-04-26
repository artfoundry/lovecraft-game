import React from 'react';
import {Filter, AdvancedReverb} from './WebAudioReverb';
import {
	StoneDoor, WindIndoors, Whispering,
	HandgunShot, GlassVialBreak, MeleeAttackBlade, MeleeAttackBlunt, AttackMiss,
	Gulp, Mine,
	ElderThing, ElderThingAttack, ElderThingInjured, ElderThingDeath,
	FlyingPolyp, FlyingPolypAttack, FlyingPolypInjured, FlyingPolypDeath,
	Ghast, GhastAttack, GhastInjured, GhastDeath,
	Ghoul, GhoulAttack, GhoulInjured, GhoulDeath,
	Shoggoth, ShoggothAttack, ShoggothInjured, ShoggothDeath,
	MaleInjured, MaleDeath, FemaleInjured, FemaleDeath,
	DiceMP3,
	CatacombsTheme, MuseumTheme
} from './audioImports';

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let gainNode = audioContext.createGain();
gainNode.connect(audioContext.destination);
const filter = new Filter(audioContext, "lowpass", 20000, 0.8);
filter.setup();
const reverb = new AdvancedReverb(audioContext);
const compressor = audioContext.createDynamicsCompressor();
compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
compressor.knee.setValueAtTime(40, audioContext.currentTime);
compressor.ratio.setValueAtTime(12, audioContext.currentTime);
compressor.attack.setValueAtTime(0, audioContext.currentTime);
compressor.release.setValueAtTime(0.25, audioContext.currentTime);
compressor.connect(gainNode);
gainNode.connect(audioContext.destination);

const audioPipelines = {};
const sfxMap = {
	catacombsDoor: StoneDoor,
	catacombsBackground: WindIndoors,
	museumBackground: Whispering,
	handgunShot: HandgunShot,
	glassVialBreak: GlassVialBreak,
	meleeAttackBlade: MeleeAttackBlade,
	meleeAttackBlunt: MeleeAttackBlunt,
	attackMiss: AttackMiss,
	gulp: Gulp,
	mine: Mine,
	elderThing: ElderThing,
	elderThingAttack: ElderThingAttack,
	elderThingInjured: ElderThingInjured,
	elderThingDeath: ElderThingDeath,
	flyingPolyp: FlyingPolyp,
	flyingPolypAttack: FlyingPolypAttack,
	flyingPolypInjured: FlyingPolypInjured,
	flyingPolypDeath: FlyingPolypDeath,
	ghast: Ghast,
	ghastAttack: GhastAttack,
	ghastInjured: GhastInjured,
	ghastDeath: GhastDeath,
	ghoul: Ghoul,
	ghoulAttack: GhoulAttack,
	ghoulInjured: GhoulInjured,
	ghoulDeath: GhoulDeath,
	shoggoth: Shoggoth,
	shoggothAttack: ShoggothAttack,
	shoggothInjured: ShoggothInjured,
	shoggothDeath: ShoggothDeath,
	maleInjured: MaleInjured,
	maleDeath: MaleDeath,
	femaleInjured: FemaleInjured,
	femaleDeath: FemaleDeath,
	dice: DiceMP3
};
const reverbIRMap = {
	catacombs: 0.8
};
const musicMap = {
	catacombs: CatacombsTheme,
	museum: MuseumTheme
};

// https://blog.gskinner.com/archives/2019/02/reverb-web-audio-api.html
function CreateReverb(activePipeline, reverbType) {
	reverb.setup(reverbIRMap[reverbType], 0.01);
	reverb.renderTail();
	reverb.wet.gain.value = 1;

	//wet
	activePipeline.connect(filter.input);
	filter.connect(reverb.input);
	reverb.connect(compressor);
}

// panning: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createPanner#examples
// may implement later
// function PanAudio(soundDeltas) {
// 	const panner = audioContext.createPanner();
//
// }

function AdjustVolume(activePipeline, volumeSetting) {
	gainNode.gain.value = volumeSetting;
}

function ProcessAudio(selectorName, audioEl, processValues) {
	if (!audioPipelines[selectorName]) {
		audioPipelines[selectorName] = audioContext.createMediaElementSource(audioEl);
	}
	const activePipeline = audioPipelines[selectorName];

	if (processValues) {
		// connect dry source
		activePipeline.connect(compressor);
		if (processValues.reverbSetting) {
			CreateReverb(activePipeline, processValues.reverbSetting);
		}
		// if (processValues.panSetting) {
		// 	PanAudio(activePipeline, processValues.panSetting);
		// }
		const volume = processValues.volumeSetting || 1;
		AdjustVolume(activePipeline, volume);
	} else {
		activePipeline.connect(audioContext.destination);
	}

	// Check if context is in suspended state (autoplay policy)
	if (audioContext.state === "suspended") {
		audioContext.resume().catch(err => console.log(err));
	}
}

function SoundEffect(props) {
	return (
		<audio ref={props.sfxRef} id={props.id} preload='auto'>
			<source src={sfxMap[props.sourceName]} type='audio/mpeg' />
		</audio>
	);
}

function Music(props) {
	return (
		<audio ref={props.musicRef} id={props.id} preload='auto' className='audio-music' loop>
			<source src={musicMap[props.sourceName]} type='audio/mpeg' />
		</audio>
	);
}

export {ProcessAudio, SoundEffect, Music};
