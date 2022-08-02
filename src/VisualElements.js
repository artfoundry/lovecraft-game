function Player(props) {
	return (
		<img alt="player"
		     className='player'
		     style={props.styleProp}
		     data-location={`${props.dataLocProp.xPos}-${props.dataLocProp.yPos}`} />
	)
}

function Exit(props) {
	return (
		<img alt="stairs"
		     className='exit'
		     style={props.styleProp}
		     data-location={props.tileNameProp} />
	)
}

function Tile(props) {
	return (
		<div className={'tile' + props.classStrProp}
		     style={{...props.styleProp, fontSize: '18px'}}
		     data-tile-num={props.tileNameProp}
		     onClick={(e) => {
			     props.placePlayerProp(props.tileNameProp, e);
		     }}></div>
	);
}

function LightElement(props) {
	return (
		<div className={props.classStrProp}
		     style={props.styleProp}
		     data-tile-num={props.tileNameProp}></div>
	);
}

export {Player, Exit, Tile, LightElement};
