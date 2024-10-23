import StoneDoorMP3 from './assets/sfx/stone_door_short.mp3';
import WindIndoorsMp3 from './assets/sfx/wind-indoors.mp3';
import HandgunShot from './assets/sfx/handgun-shot.mp3';
import GlassVialBreak from './assets/sfx/glass-vial-break.mp3';
import MeleeAttackBlade from './assets/sfx/melee-attack-blade.mp3';
import MeleeAttackBlunt from './assets/sfx/melee-attack-blunt.mp3';
import AttackMiss from './assets/sfx/attack-miss.mp3';
import Gulp from './assets/sfx/gulp.mp3';
import ElderThing from './assets/sfx/elder-thing.mp3';
import Shoggoth from './assets/sfx/shoggoth.mp3';
import Ghoul from './assets/sfx/ghoul.mp3';
import MaleInjured from './assets/sfx/male-injured.mp3';
import MaleDeath from './assets/sfx/male-death.mp3';
import FemaleInjured from './assets/sfx/female-injured.mp3';
import FemaleDeath from './assets/sfx/female-death.mp3';
import DiceMP3 from './assets/sfx/rolling-dice-1.mp3';
import CatacombsThemeM4A from './assets/music/catacombs_theme.m4a';

const sfxMap = {
	stoneDoor: StoneDoorMP3,
	windIndoors: WindIndoorsMp3,
	handgunShot: HandgunShot,
	glassVialBreak: GlassVialBreak,
	meleeAttackBlade: MeleeAttackBlade,
	meleeAttackBlunt: MeleeAttackBlunt,
	attackMiss: AttackMiss,
	gulp: Gulp,
	elderThing: ElderThing,
	shoggoth: Shoggoth,
	ghoul: Ghoul,
	maleInjured: MaleInjured,
	maleDeath: MaleDeath,
	femaleInjured: FemaleInjured,
	femaleDeath: FemaleDeath,
	dice: DiceMP3
};

const musicMap = {
	catacombs: CatacombsThemeM4A
};

function SoundEffect(props) {
	return (<audio id={props.idProp} preload='auto'>
		<source src={sfxMap[props.sourceName]} type='audio/mpeg' />
	</audio>);
}

function Music(props) {
	return (<audio id={props.idProp} preload='auto' className='audio-music' loop>
		<source src={musicMap[props.sourceName]} type='audio/mpeg' />
	</audio>);
}

export {SoundEffect, Music};
