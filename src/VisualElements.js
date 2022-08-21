import React, { useState } from 'react';
import {randomTileVariant} from './Utils';

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
		<img alt="exit"
		     className='exit'
		     style={props.styleProp}
		     data-location={props.tileNameProp} />
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
		     onClick={(e) => {
			     props.placePlayerProp(props.tileNameProp, e);
		     }} />
	);
}

function LightElement(props) {
	return (
		<div className={props.classStrProp}
		     style={props.styleProp}
		     data-tile-num={props.tileNameProp} />
	);
}

export {Player, Exit, Tile, LightElement};
