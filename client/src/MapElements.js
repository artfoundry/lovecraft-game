import React, {useState} from 'react';
import {randomTileVariant, convertPosToCoords} from './Utils';
import './css/mapPieceElements.css';

function Character(props) {
	const isHiddenClass = props.isHidden ? ' hidden' : '';
	const isSelectedClass = !props.isHidden && props.isSelected ? ' selected' : '';
	const isDeadClass = !props.isHidden && props.isDead ? ` ${props.idClassName}-dead dead` : '';
	const isInRangeClass = !props.isHidden && !props.isDead && props.isInRange ? ' in-range' : '';
	return (
		<img id={props.id}
		     ref={props.charRef}
			 alt={props.classes}
		     className={props.characterType + ' ' + props.idClassName + isHiddenClass + isSelectedClass + isDeadClass + isInRangeClass}
		     style={props.styles}
		     data-location={props.charPos}
			 onClick={(evt) => {
				 if (props.tileIsVisible) {
					 const actionInfo = {
						 id: props.id,
						 target: props.dataCharType,
						 isInRange: props.isInRange,
						 checkLineOfSightToParty: props.isLineOfSight
					 };
					 props.updateContextMenu(props.characterType, props.charPos, evt, actionInfo);
				 }
			 }} />
	)
}

function Exit(props) {
	return (
		<img alt='exit'
		     className='object exit'
		     style={props.styleProp} />
	)
}

function Tile(props) {
	const isTopOrBottomWall = props.classStr.includes('top-wall') || props.classStr.includes('bottom-wall');
	const tileType = props.tileType === 'floor' || (props.tileType === 'wall' && isTopOrBottomWall) ? randomTileVariant() : '';

	const [randomizedVariantSuffix] = useState(tileType);

	return (
		<div className={`tile ${props.classStr}${randomizedVariantSuffix}`}
		     style={{...props.styleProp, fontSize: '18px'}}
		     data-tile-num={props.tileName}
		     data-light-strength={props.dataLightStr}
		     onClick={e => {
				 props.moveCharacter(props.tileName, e);
		     }}>
		</div>
	);
}

function Door(props) {
	return <div className={props.classProp} style={props.styleProp} />;
}

function Item(props) {
	const isHiddenClass = !props.tileIsVisible ? ' hidden' : '';
	return (
		<img
			alt={props.name}
			className={`object ${props.name}${isHiddenClass}`}
			style={props.styles}
			onClick={(evt) => {
				if (props.tileIsVisible) {
					props.updateContextMenu('look', props.tilePos, evt, {objectInfo: [props.objectInfo], selectionEvt: evt, isPickUpAction: false});
				}
			}}
		/>
	)
}

function LightElement(props) {
	return (
		<div className={props.classes}
		     style={props.styles}
		     data-tile-num={props.tileName} />
	);
}

function MapCover(props) {
	return (
		<div className='map-cover' style={props.styleProp}></div>
	)
}

export {Character, Exit, Tile, Door, Item, LightElement, MapCover};
