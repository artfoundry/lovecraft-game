import React, {useState} from 'react';
import {randomTileVariant} from './Utils';
import './css/mapPieceElements.css';

function Character(props) {
	const isHiddenClass = props.isHidden ? ' hidden' : '';
	const isSelectedClass = !props.isHidden && props.isSelected ? ' selected' : '';
	const isDeadClass = !props.isHidden && props.isDead ? ` ${props.idClassName}-dead dead` : '';
	const isDyingOrCatatonicClass = !props.isHidden && (props.isDying || props.isCatatonic) ? ` ${props.idClassName}-dead` : '';
	const isInRangeClass = !props.isHidden && props.isInRange ? ' in-range' : '';
	const isOnTopClass = props.isOtherCharOnTop ? ' character-on-top' : '';
	const isStealthyClass = props.isStealthy ? ' stealthy': '';
	return (
		<img id={props.id}
		     ref={props.charRef}
			 alt={props.classes}
		     draggable={false}
		     className={props.characterType + ' ' + props.idClassName + isHiddenClass + isSelectedClass + isDyingOrCatatonicClass + isDeadClass + isInRangeClass + isOnTopClass + isStealthyClass}
		     style={props.styles}
		     data-location={props.charPos}
			 onClick={(evt) => {
				 const actionInfo = {
					 id: props.id,
					 target: props.characterType,
					 isInRange: props.isInRange,
					 checkLineOfSightToParty: props.isLineOfSight
				 };
				 props.updateContextMenu(props.characterType, props.charPos, evt, actionInfo);
			 }} />
	)
}

function Exit(props) {
	return (
		<img alt='exit'
		     draggable={false}
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
		     draggable={false}
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
	return <div className={props.classProp} style={props.styleProp} draggable={false} />;
}

function Item(props) {
	const isHiddenClass = !props.tileIsVisible ? ' hidden' : '';
	return (
		<img
			alt={props.name}
			className={`object ${props.name}${isHiddenClass}`}
			style={props.styles}
			draggable={false}
			onClick={(evt) => {
				if (props.tileIsVisible) {
					props.updateContextMenu('examine', props.tilePos, evt, {objectInfo: [props.objectInfo], selectionEvt: evt, isPickUpAction: false});
				}
			}}
		/>
	)
}

function LightElement(props) {
	return (
		<div className={props.classes}
		     style={props.styles}
		     draggable={false}
		     data-tile-num={props.tileName} />
	);
}

function MapCover(props) {
	return (
		<div className='map-cover' style={props.styleProp} draggable={false}></div>
	)
}

export {Character, Exit, Tile, Door, Item, LightElement, MapCover};
