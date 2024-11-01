import StoneDoorMP3 from './assets/sfx/environments/stone_door_short.mp3';
import WindIndoorsMp3 from './assets/sfx/environments/wind-indoors.mp3';
import HandgunShot from './assets/sfx/weapons/handgun-shot.mp3';
import GlassVialBreak from './assets/sfx/weapons/glass-vial-break.mp3';
import MeleeAttackBlade from './assets/sfx/weapons/melee-attack-blade.mp3';
import MeleeAttackBlunt from './assets/sfx/weapons/melee-attack-blunt.mp3';
import AttackMiss from './assets/sfx/weapons/attack-miss.mp3';
import Gulp from './assets/sfx/items/gulp.mp3';
import ElderThing from './assets/sfx/characters/elder-thing.mp3';
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
