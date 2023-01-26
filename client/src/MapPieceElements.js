import React, {useState} from 'react';
import {randomTileVariant} from './Utils';

function Character(props) {
	return (
		<img id={props.idProp}
			 alt={props.classesProp}
		     className={props.classesProp}
		     style={props.styleProp}
		     data-location={`${props.dataLocProp.xPos}-${props.dataLocProp.yPos}`}
			 onClick={() => {
				 props.clickUnitProp(props.idProp, props.dataCharTypeProp);
			 }} />
	)
}

function Exit(props) {
	return (
		<img alt="exit"
		     className='object exit'
		     style={props.styleProp} />
	)
}

function Tile(props) {
	const isTopOrBottomWall = props.classStrProp.includes('top-wall') || props.classStrProp.includes('bottom-wall');
	const tileType = props.tileTypeProp === 'floor' || (props.tileTypeProp === 'wall' && isTopOrBottomWall) ? randomTileVariant() : '';

	const [randomizedVariantSuffix] = useState(tileType);

	return (
		<div className={`tile ${props.classStrProp}${randomizedVariantSuffix}`}
		     style={{...props.styleProp, fontSize: '18px'}}
		     data-tile-num={props.tileNameProp}
		     onClick={e => {
			     props.moveCharacterProp(props.tileNameProp, e);
		     }}>
		</div>
	);
}

function Door(props) {
	return (<div className={props.classProp} style={props.styleProp} />);
}

function LightElement(props) {
	return (
		<div className={props.classStrProp}
		     style={props.styleProp}
		     data-tile-num={props.tileNameProp} />
	);
}

export {Character, Exit, Tile, Door, LightElement};
