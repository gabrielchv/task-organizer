/**
 * Captures microphone frames on the audio rendering thread and forwards them to
 * the main thread in fixed-size blocks.
 *
 * Replaces ScriptProcessorNode, which is deprecated and ran its callback on the
 * main thread — every recognition frame competed with React rendering, which is
 * why the UI stuttered while the wake word was listening.
 */
const FRAME_SIZE = 4096;

class PcmForwarder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(FRAME_SIZE);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    let read = 0;
    while (read < channel.length) {
      const take = Math.min(FRAME_SIZE - this.offset, channel.length - read);
      this.buffer.set(channel.subarray(read, read + take), this.offset);
      this.offset += take;
      read += take;

      if (this.offset === FRAME_SIZE) {
        // Transfer a copy so the worklet keeps writing into its own buffer.
        const frame = this.buffer.slice();
        this.port.postMessage(frame, [frame.buffer]);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("pcm-forwarder", PcmForwarder);
