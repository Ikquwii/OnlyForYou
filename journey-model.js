(function (root) {
  'use strict';

  const VERSION = 1;
  const START_X = 180;
  const WALK_SPEED = 180;
  const ENCOURAGED_SPEED = 210;
  const ACCELERATION = 330;
  const DECELERATION = 450;
  const PHASE_PER_WORLD_UNIT = 1 / 30;
  const BRIDGE_DURATION = 1.1;
  const GATE_DURATION = 1;
  const LEAP_DURATION = 1.6;
  const DELIVERY_DURATION = 0.9;
  const CHECKPOINTS = ['intro', 'bridge', 'gate', 'window', 'complete'];
  const WALK_SEGMENTS = {
    'walk-bridge': { from: START_X, to: 730, next: 'bridge' },
    'walk-gate': { from: 730, to: 1680, next: 'gate' },
    'walk-window': { from: 1680, to: 3000, next: 'window' },
  };

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const smoothstep = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
  };

  class CatJourney {
    constructor() {
      this.reset();
    }

    reset() {
      this._stage = 'intro';
      this._x = START_X;
      this._speed = 0;
      this._phase = 0;
      this._jump = 0;
      this._bridge = 0;
      this._gate = 0;
      this._delivery = 0;
      this._pet = 0;
      this._checkpoint = 'intro';
      this._elapsed = 0;
      this._encouragedFor = 0;
      this._paused = false;
      return this;
    }

    start() {
      if (this._paused || this._stage !== 'intro') return false;
      this._stage = 'walk-bridge';
      return true;
    }

    action(action) {
      if (this._paused) return false;
      const next = {
        bridge: { at: 'bridge', stage: 'making-bridge' },
        bell: { at: 'gate', stage: 'opening-gate' },
        window: { at: 'window', stage: 'delivery' },
      }[action];
      if (!next || this._stage !== next.at) return false;
      this._stage = next.stage;
      this._elapsed = 0;
      this._speed = 0;
      return true;
    }

    moveTo(worldX) {
      const segment = WALK_SEGMENTS[this._stage];
      if (this._paused || !segment || !Number.isFinite(worldX)) return false;
      if (worldX < this._x || worldX < segment.from || worldX > segment.to) return false;

      // A path tap encourages the walk; its automatic destination stays at the next interaction.
      this._encouragedFor = 1.2;
      return true;
    }

    pet() {
      if (this._paused) return false;
      this._pet = 1;
      return true;
    }

    setPaused(paused) {
      this._paused = Boolean(paused);
      return this;
    }

    step(dtSeconds) {
      if (this._paused || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return this;
      const dt = Math.min(dtSeconds, 0.05);

      this._pet *= Math.exp(-dt * 2.8);
      if (this._pet < 0.001) this._pet = 0;

      const segment = WALK_SEGMENTS[this._stage];
      if (segment) {
        this._walk(segment, dt);
      } else if (this._stage === 'making-bridge') {
        this._elapsed += dt;
        this._bridge = smoothstep(this._elapsed / BRIDGE_DURATION);
        if (this._elapsed >= BRIDGE_DURATION) {
          this._bridge = 1;
          this._stage = 'walk-gate';
          this._elapsed = 0;
        }
      } else if (this._stage === 'opening-gate') {
        this._elapsed += dt;
        this._gate = smoothstep(this._elapsed / GATE_DURATION);
        if (this._elapsed >= GATE_DURATION) {
          this._gate = 1;
          this._stage = 'walk-window';
          this._elapsed = 0;
        }
      } else if (this._stage === 'delivery') {
        this._deliver(dt);
      }

      this._encouragedFor = Math.max(0, this._encouragedFor - dt);
      return this;
    }

    _walk(segment, dt) {
      const remaining = segment.to - this._x;
      const limit = this._encouragedFor > 0 ? ENCOURAGED_SPEED : WALK_SPEED;
      const desiredSpeed = Math.min(limit, Math.sqrt(2 * DECELERATION * remaining));
      const change = desiredSpeed - this._speed;
      const maxChange = (change >= 0 ? ACCELERATION : DECELERATION) * dt;
      const nextSpeed = this._speed + Math.sign(change) * Math.min(Math.abs(change), maxChange);
      const distance = Math.min(remaining, (this._speed + nextSpeed) * dt / 2);
      this._x += distance;
      this._phase += distance * PHASE_PER_WORLD_UNIT;
      this._speed = nextSpeed;

      if (remaining - distance <= 0.05) {
        this._phase += (segment.to - this._x) * PHASE_PER_WORLD_UNIT;
        this._x = segment.to;
        this._speed = 0;
        this._stage = segment.next;
        this._checkpoint = segment.next;
        this._encouragedFor = 0;
      }
    }

    _deliver(dt) {
      this._elapsed += dt;
      const leap = clamp01(this._elapsed / LEAP_DURATION);
      const easedLeap = smoothstep(leap);
      const nextX = 3000 + 380 * easedLeap;
      const distance = nextX - this._x;
      this._x = nextX;
      this._phase += distance * PHASE_PER_WORLD_UNIT;
      this._speed = distance / dt;

      // jump is the full elevation above ground 700, including the window ledge at 500.
      this._jump = 200 * easedLeap + 95 * 4 * leap * (1 - leap);
      this._delivery = clamp01((this._elapsed - LEAP_DURATION) / DELIVERY_DURATION);
      if (this._elapsed >= LEAP_DURATION) this._speed = 0;
      if (this._delivery >= 1) {
        this._stage = 'complete';
        this._checkpoint = 'complete';
      }
    }

    restore(checkpoint) {
      if (!CHECKPOINTS.includes(checkpoint)) return false;
      this.reset();
      this._checkpoint = checkpoint;
      this._stage = checkpoint;
      if (checkpoint === 'bridge') this._x = 730;
      if (checkpoint === 'gate') {
        this._x = 1680;
        this._bridge = 1;
      }
      if (checkpoint === 'window' || checkpoint === 'complete') {
        this._x = checkpoint === 'complete' ? 3380 : 3000;
        this._bridge = 1;
        this._gate = 1;
      }
      if (checkpoint === 'complete') {
        this._jump = 200;
        this._delivery = 1;
      }
      this._phase = (this._x - START_X) * PHASE_PER_WORLD_UNIT;
      return true;
    }

    snapshot() {
      return {
        stage: this._stage,
        x: this._x,
        speed: this._speed,
        phase: this._phase,
        jump: this._jump,
        bridge: this._bridge,
        gate: this._gate,
        delivery: this._delivery,
        pet: this._pet,
        complete: this._stage === 'complete',
        checkpoint: this._checkpoint,
        version: VERSION,
      };
    }
  }

  if (typeof module === 'object' && module.exports) module.exports = CatJourney;
  if (root) root.CatJourney = CatJourney;
})(typeof window !== 'undefined' ? window : undefined);
