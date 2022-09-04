import StoneDoorMP3 from './assets/sfx/stone_door_short.mp3';

function StoneDoor(props) {
	return (<audio id={props.idProp} preload="auto">
		<source src={StoneDoorMP3} type="audio/mpeg" />
	</audio>);
}

export {StoneDoor};
