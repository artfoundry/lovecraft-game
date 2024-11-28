// Library from https://blog.gskinner.com/archives/2019/02/reverb-web-audio-api.html

// SAFARI Polyfills
if(!window.AudioBuffer.prototype.copyToChannel) {
	window.AudioBuffer.prototype.copyToChannel = function copyToChannel (buffer,channel) {
		this.getChannelData(channel).set(buffer);
	}
}
if(!window.AudioBuffer.prototype.copyFromChannel) {
	window.AudioBuffer.prototype.copyFromChannel = function copyFromChannel (buffer,channel) {
		buffer.set(this.getChannelData(channel));
	}
}

class Effect {
	constructor (context) {
		this.name = "effect";
		this.context = context;
		this.input = this.context.createGain();
		this.effect = null;
		this.output = this.context.createGain();
		this.setup();
		this.wireUp();
	}

	setup() {
		this.effect = this.context.createGain();
	}

	wireUp() {
		this.input.connect(this.effect);
		this.effect.connect(this.output);
	}

	connect(destination) {
		this.output.connect(destination);
	}
}

// Not currently needed for game
// class Sample {
// 	constructor (context) {
// 		this.context = context;
// 		this.buffer = this.context.createBufferSource();
// 		this.buffer.start();
// 		this.sampleBuffer = null
// 		this.loaded = false;
// 		this.output = this.context.createGain();
// 		this.output.gain.value = 0.1;
// 	}
//
// 	play () {
// 		if(this.loaded) {
// 			this.buffer = this.context.createBufferSource();
// 			this.buffer.buffer = this.sampleBuffer;
// 			this.buffer.connect(this.output);
// 			this.buffer.start(this.context.currentTime);
// 		}
// 	}
//
// 	connect (input) {
// 		this.output.connect(input);
// 	}
//
// 	load (path) {
// 		this.loaded = false;
// 		return fetch(path)
// 			.then((response) => response.arrayBuffer())
// 			.then((myBlob) => {
// 				return new Promise((resolve, reject)=>{
// 					this.context.decodeAudioData(myBlob, resolve, reject);
// 				})
// 			})
// 			.then((buffer) => {
// 				this.sampleBuffer = buffer;
// 				this.loaded = true;
// 				return this;
// 			});
// 	}
// }


class AmpEnvelope {
	constructor (context, gain = 1) {
		this.context = context;
		this.output = this.context.createGain();
		this.output.gain.value = gain;
		this.velocity = 0;
		this.gain = gain;
		this._attack = 0;
		this._decay = 0.001;
		this._sustain = this.output.gain.value;
		this._release = 0.001;
	}

	on (velocity) {
		this.velocity = velocity / 127;
		this.start(this.context.currentTime);
	}

	off () {
		return this.stop(this.context.currentTime);
	}

	start (time) {
		this.output.gain.value = 0;
		this.output.gain.setValueAtTime(0, time);
		this.output.gain.setTargetAtTime(1, time, this.attack+0.00001);
		this.output.gain.setTargetAtTime(this.sustain * this.velocity, time + this.attack, this.decay);
	}

	stop (time) {
		this.sustain = this.output.gain.value;
		this.output.gain.cancelScheduledValues(time);
		this.output.gain.setValueAtTime(this.sustain, time);
		this.output.gain.setTargetAtTime(0, time, this.release+0.00001);
	}

	set attack (value) {
		this._attack = value;
	}

	get attack () {
		return this._attack
	}

	set decay (value) {
		this._decay = value;
	}

	get decay () {
		return this._decay;
	}

	set sustain (value) {
		this.gain = value;
		this._sustain = value;
	}

	get sustain () {
		return this.gain;
	}

	set release (value) {
		this._release = value;
	}

	get release () {
		return this._release;
	}

	connect (destination) {
		this.output.connect(destination);
	}
}

class Voice {
	constructor(context, type ="sawtooth", gain = 0.1) {
		this.context = context;
		this.type = type;
		this.value = -1;
		this.gain = gain;
		this.output = this.context.createGain();
		this.partials = [];
		this.output.gain.value = this.gain;
		this.ampEnvelope = new AmpEnvelope(this.context);
		this.ampEnvelope.connect(this.output);
	}

	init() {
		let osc = this.context.createOscillator();
			osc.type = this.type;
			osc.connect(this.ampEnvelope.output);
			osc.start(this.context.currentTime);
		this.partials.push(osc);
	}

	on(MidiEvent) {
		this.value = MidiEvent.value;
		this.partials.forEach((osc) => {
			osc.frequency.value = MidiEvent.frequency;
		});
		this.ampEnvelope.on(MidiEvent.velocity || MidiEvent);
	}

	off(MidiEvent) {
		this.ampEnvelope.off(MidiEvent);
		this.partials.forEach((osc) => {
			osc.stop(this.context.currentTime + this.ampEnvelope.release * 4);
		});
	}

	connect(destination) {
		this.output.connect(destination);
	}

	set detune (value) {
		this.partials.forEach(p=>p.detune.value=value);
	}
  
	set attack (value) {
		this.ampEnvelope.attack  = value;
	}

	get attack () {
		return this.ampEnvelope.attack;
	}

	set decay (value) {
		this.ampEnvelope.decay  = value;
	}

	get decay () {
		return this.ampEnvelope.decay;
	}

	set sustain (value) {
		this.ampEnvelope.sustain = value;
	}

	get sustain () {
		return this.ampEnvelope.sustain;
	}

	set release (value) {
		this.ampEnvelope.release = value;
	}

	get release () {
		return this.ampEnvelope.release;
	}
}

class Noise extends Voice {
	constructor(context, gain) {
		super(context, gain);
		this._length = 2;
	}

	get length () {
		return this._length || 2;
	}
	set length (value) {
		this._length = value;
	}

	init() {
		let lBuffer = new Float32Array(this.length * this.context.sampleRate);
		let rBuffer = new Float32Array(this.length * this.context.sampleRate);
		for(let i = 0; i < this.length * this.context.sampleRate; i++) {
			lBuffer[i] = 1-(2*Math.random());
			rBuffer[i] = 1-(2*Math.random());
		}
		let buffer = this.context.createBuffer(2, this.length * this.context.sampleRate, this.context.sampleRate);
		buffer.copyToChannel(lBuffer,0);
		buffer.copyToChannel(rBuffer,1);

		let osc = this.context.createBufferSource();
			osc.buffer = buffer;
			osc.loop = true;
			osc.loopStart = 0;
			osc.loopEnd = 2;
			osc.start(this.context.currentTime);
			osc.connect(this.ampEnvelope.output);
		this.partials.push(osc);
	}

	on(MidiEvent) {
		this.value = MidiEvent.value;
		this.ampEnvelope.on(MidiEvent.velocity || MidiEvent);
	}
}

export class Filter extends Effect {
	constructor (context, type = "lowpass", cutoff = 1000, resonance = 0.9) {
		super(context);
		this.name = "filter";
		this.effect.frequency.value = cutoff;
		this.effect.Q.value = resonance;
		this.effect.type = type;
	}

	setup() {
		this.effect = this.context.createBiquadFilter();
		this.effect.connect(this.output);
        this.wireUp();
	}
}

const OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
class SimpleReverb extends Effect {
	constructor (context) {
		super(context);
		this.name = "SimpleReverb";
	}

	setup (reverbTime=1) {
		this.effect = this.context.createConvolver();

		this.reverbTime = reverbTime;

		this.attack = 0.0001;
		this.decay = 0.1;
		this.release = reverbTime;

		this.wet = this.context.createGain();
		this.input.connect(this.wet);
		this.wet.connect(this.effect);
		this.effect.connect(this.output);
	}

	renderTail () {
		const tailContext = new OfflineAudioContext( 2, this.context.sampleRate * this.reverbTime, this.context.sampleRate );
		tailContext.oncomplete = (buffer) => {
			this.effect.buffer = buffer.renderedBuffer;
		}

		const tailOsc = new Noise(tailContext, 1);
		tailOsc.init();
		tailOsc.connect(tailContext.destination);
		tailOsc.attack = this.attack;
		tailOsc.decay = this.decay;
		tailOsc.release = this.release;


		tailOsc.on({frequency: 500, velocity: 1});
		tailContext.startRendering();
		setTimeout(()=>{
			tailOsc.off();
		},20)
	}

	set decayTime(value) {
		let dc = value/3;
		this.reverbTime = value;
		this.attack = 0;
		this.decay = 0;
		this.release = dc;
		return this.renderTail();
	}

}

export class AdvancedReverb extends SimpleReverb {
	constructor (context) {
		super(context);
		this.name = "AdvancedReverb";
	}

	setup (reverbTime= 1, preDelay = 0.03) {
		this.effect = this.context.createConvolver();

		this.reverbTime = reverbTime;

		this.attack = 0.001;
		this.decay = 0.1;
		this.release = reverbTime;

		this.preDelay = this.context.createDelay(reverbTime);
		this.preDelay.delayTime.setValueAtTime(preDelay, this.context.currentTime);

		this.multitap = [];

		for(let i = 2; i > 0; i--) {
			this.multitap.push(this.context.createDelay(reverbTime));
		}
		this.multitap.map((t,i)=>{
			if(this.multitap[i+1]) {
				t.connect(this.multitap[i+1])
			}
			t.delayTime.setValueAtTime(0.001+(i*(preDelay/2)), this.context.currentTime);
		})

		this.multitapGain = this.context.createGain();
		this.multitap[this.multitap.length-1].connect(this.multitapGain);

		this.multitapGain.gain.value = 0.2;

		this.multitapGain.connect(this.output);

		this.wet = this.context.createGain();

		this.input.connect(this.wet);
		this.wet.connect(this.preDelay);
		this.wet.connect(this.multitap[0]);
		this.preDelay.connect(this.effect);
		this.effect.connect(this.output);

	}
	renderTail () {
		const tailContext = new OfflineAudioContext( 2, this.context.sampleRate * this.reverbTime, this.context.sampleRate );
		tailContext.oncomplete = (buffer) => {
			this.effect.buffer = buffer.renderedBuffer;
		}
		const tailOsc = new Noise(tailContext, 1);
		const tailLPFilter = new Filter(tailContext, "lowpass", 2000, 0.2);
		const tailHPFilter = new Filter(tailContext, "highpass", 500, 0.1);

		tailOsc.init();
		tailOsc.connect(tailHPFilter.input);
		tailHPFilter.connect(tailLPFilter.input);
		tailLPFilter.connect(tailContext.destination);
		tailOsc.attack = this.attack;
		tailOsc.decay = this.decay;
		tailOsc.release = this.release;

		tailContext.startRendering()

		tailOsc.on({frequency: 500, velocity: 1});
		setTimeout(()=>{
			tailOsc.off();
		},20)
	}

	set decayTime(value) {
		const dc = value/3;
		this.reverbTime = value;
		this.attack = 0;
		this.decay = 0;
		this.release = dc;
		return this.renderTail();
	}
}
