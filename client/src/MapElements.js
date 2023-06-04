import React, {useState} from 'react';
import {randomTileVariant} from './Utils';
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
		     data-location={`${props.dataLoc.xPos}-${props.dataLoc.yPos}`}
			 onClick={() => {
				 props.clickUnit(props.id, props.dataCharType, props.isInRange, props.isLineOfSight);
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
	return <div className={props.classProp} style={props.styleProp} />;
}

function Item(props) {
	return (
		<img
			alt={props.name}
			className={`object ${props.name}`}
			style={props.styles}
			onClick={() => {
				if (props.isActivePlayerNearObject(props.objectInfo.coords)) {
					props.addItemToPlayerInventory(props.objectInfo, props.objectId);
				} else {
					props.setShowDialogProps(true, props.dialogProps);
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

export {Character, Exit, Tile, Door, Item, LightElement};
