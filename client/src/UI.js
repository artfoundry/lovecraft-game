import React from "react";
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			logText: this.props.logTextProp,
			characterIsSelected: this.props.characterIsSelectedProp,
			creatureIsSelected: this.props.creatureIsSelectedProp,
			characterText: this.props.characterInfoTextProp,
			controlBarContent: this.props.controlsContentProp
		};
	}

	addLogLines = () => {
		let lines = [];
		let i = 0;
		this.state.logText.forEach(line => {
			lines.push(<div key={i} className="log-line">{line}</div>);
			i++;
		});

		return lines;
	}

	showCharacterInfo() {

	}

	showControlBar() {

	}

	componentDidUpdate(prevProps, prevState, snapShot) {
		if (prevProps.logTextProp !== this.props.logTextProp) {
			this.setState({logText: [...this.props.logTextProp]});
		}
		if (prevProps.characterIsSelectedProp !== this.props.characterIsSelectedProp) {
			this.setState(prevState => ({characterIsSelected: !prevState.characterIsSelected}));
		}
		if (prevProps.creatureIsSelectedProp !== this.props.creatureIsSelectedProp) {
			this.setState(prevState => ({creatureIsSelected: !prevState.creatureIsSelected}));
		}
	}

	render() {
		return (
			<div className="ui-container">
				<div className="log-container">{this.state.logText && <this.addLogLines />}</div>
				<div className={`character-info-container ${this.state.characterIsSelected || this.state.creatureIsSelected ? '' : 'hide'}`}>{this.state.characterText && <this.showCharacterInfo />}</div>
				<div className="control-bar-container">{this.state.controlBarContent && <this.showControlBar />}</div>
			</div>
		);
	}
}

export default UI;
