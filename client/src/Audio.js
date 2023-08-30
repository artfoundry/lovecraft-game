import StoneDoorMP3 from './assets/sfx/stone_door_short.mp3';
import CatacombsThemeM4A from './assets/music/catacombs_theme.m4a';

const sfxMap = {
	stoneDoor: StoneDoorMP3
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
	return (<audio id={props.idProp} preload='auto' className='audio-music' loop controls controlsList="nofullscreen nodownload noremoteplayback noplaybackrate foobar">
		<source src={musicMap[props.sourceName]} type='audio/mpeg' />
	</audio>);
}

export {SoundEffect, Music};
