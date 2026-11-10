/** 拍立得吐纸声：Web Audio 合成马达嗡声 + 结尾咔嗒，无外部资源 */
export function playEject() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const t = ac.currentTime;
    const dur = 1.1;
    const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 2;
    const motor = ac.createOscillator();
    motor.type = "sawtooth"; motor.frequency.setValueAtTime(110, t); motor.frequency.linearRampToValueAtTime(95, t + dur);
    const mg = ac.createGain(); mg.gain.value = 0.05;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.05);
    g.gain.setValueAtTime(0.35, t + dur - 0.15); g.gain.linearRampToValueAtTime(0, t + dur);
    noise.connect(bp).connect(g); motor.connect(mg).connect(g); g.connect(ac.destination);
    noise.start(t); motor.start(t); noise.stop(t + dur); motor.stop(t + dur);
    // 咔嗒
    const click = ac.createOscillator(); const cg = ac.createGain();
    click.type = "square"; click.frequency.value = 1800;
    cg.gain.setValueAtTime(0.25, t + dur); cg.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
    click.connect(cg).connect(ac.destination); click.start(t + dur); click.stop(t + dur + 0.06);
    setTimeout(() => ac.close(), (dur + 0.3) * 1000);
  } catch {
    /* 不支持音频时静默 */
  }
}
