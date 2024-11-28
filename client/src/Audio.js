import React from 'react';
import {Filter, AdvancedReverb} from './WebAudioReverb';
import StoneDoorMP3 from './assets/sfx/environments/stone_door_short.mp3';
import WindIndoorsMp3 from './assets/sfx/environments/wind-indoors.mp3';
import HandgunShot from './assets/sfx/weapons/handgun-shot.mp3';
import GlassVialBreak from './assets/sfx/weapons/glass-vial-break.mp3';
import MeleeAttackBlade from './assets/sfx/weapons/melee-attack-blade.mp3';
import MeleeAttackBlunt from './assets/sfx/weapons/melee-attack-blunt.mp3';
import AttackMiss from './assets/sfx/weapons/attack-miss.mp3';
import Gulp from './assets/sfx/items/gulp.mp3';
import Mine from './assets/sfx/skills/mine.mp3';
import ElderThing from './assets/sfx/characters/elder-thing.mp3';
import ElderThingAttack from './assets/sfx/characters/elder-thing-attack.mp3';
import ElderThingInjured from './assets/sfx/characters/elder-thing-injured.mp3';
import ElderThingDeath from './assets/sfx/characters/elder-thing-death.mp3';
import Shoggoth from './assets/sfx/characters/shoggoth.mp3';
import ShoggothAttack from './assets/sfx/characters/shoggoth-attack.mp3';
import ShoggothInjured from './assets/sfx/characters/shoggoth-injured.mp3';
import ShoggothDeath from './assets/sfx/characters/shoggoth-death.mp3';
import Ghoul from './assets/sfx/characters/ghoul.mp3';
import GhoulAttack from './assets/sfx/characters/ghoul-attack.mp3';
import GhoulInjured from './assets/sfx/characters/ghoul-injured.mp3';
import GhoulDeath from './assets/sfx/characters/ghoul-death.mp3';
import MaleInjured from './assets/sfx/characters/male-injured.mp3';
import MaleDeath from './assets/sfx/characters/male-death.mp3';
import FemaleInjured from './assets/sfx/characters/female-injured.mp3';
import FemaleDeath from './assets/sfx/characters/female-death.mp3';
import DiceMP3 from './assets/sfx/rolling-dice-1.mp3';
import CatacombsThemeM4A from './assets/music/catacombs_theme.m4a';

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const audioPipelines = {};
const sfxMap = {
	catacombsDoor: StoneDoorMP3,
	catacombsBackground: WindIndoorsMp3,
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
	shoggoth: Shoggoth,
	shoggothAttack: ShoggothAttack,
	shoggothInjured: ShoggothInjured,
	shoggothDeath: ShoggothDeath,
	ghoul: Ghoul,
	ghoulAttack: GhoulAttack,
	ghoulInjured: GhoulInjured,
	ghoulDeath: GhoulDeath,
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
	catacombs: CatacombsThemeM4A
};

// https://blog.gskinner.com/archives/2019/02/reverb-web-audio-api.html
function CreateReverb(audioContext, activePipeline, reverbType) {
	const filter = new Filter(audioContext, "lowpass", 20000, 0.8);
	filter.setup();

	const reverb = new AdvancedReverb(audioContext);
	reverb.setup(reverbIRMap[reverbType], 0.01);
	reverb.renderTail();
	reverb.wet.gain.value = 1;

	const compressor = audioContext.createDynamicsCompressor();
	compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
	compressor.knee.setValueAtTime(40, audioContext.currentTime);
	compressor.ratio.setValueAtTime(12, audioContext.currentTime);
	compressor.attack.setValueAtTime(0, audioContext.currentTime);
	compressor.release.setValueAtTime(0.25, audioContext.currentTime);
	compressor.connect(audioContext.destination);

	filter.connect(reverb.input);
	reverb.connect(compressor);

	activePipeline.connect(filter.input);
	activePipeline.connect(compressor);
}

// panning: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createPanner#examples
function PanAudio(audioContext) {
	const panner = audioContext.createPanner();

}

function ProcessAudio(selectorName, audioEl, processValues) {
	if (!audioPipelines[selectorName]) {
		audioPipelines[selectorName] = audioContext.createMediaElementSource(audioEl);
	}
	const activePipeline = audioPipelines[selectorName];

	if (processValues) {
		if (processValues.pan) {
			PanAudio(activePipeline, processValues.pan);
		}
		if (processValues.reverb) {
			CreateReverb(audioContext, activePipeline, processValues.reverb);
		}
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
	return (<audio id={props.idProp} preload='auto' className='audio-music' loop>
		<source src={musicMap[props.sourceName]} type='audio/mpeg' />
	</audio>);
}

export {ProcessAudio, SoundEffect, Music};
