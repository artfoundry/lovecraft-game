import React from "react";
import './css/ui.css';

class UI extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			logText: this.props.logTextProp
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

	componentDidUpdate(prevProps, prevState, snapShot) {
		if (prevProps.logTextProp !== this.props.logTextProp) {
			this.setState({logText: [...this.props.logTextProp]});
		}
	}

	render() {
		return (
			<div className="log-container">{this.state.logText && <this.addLogLines />}</div>
		);
	}
}

export default UI;
