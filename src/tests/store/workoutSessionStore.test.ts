import { useWorkoutSessionStore } from '@/store/workoutSessionStore';
import type { HeartRateSample } from '@/interfaces/heartRate';

describe('useWorkoutSessionStore', () => {
  let dateSpy: jest.SpyInstance<number, []>;
  let currentTime: number;

  const mockSample: HeartRateSample = {
    bpm: 120,
    sensorContact: 'contactDetected',
    timestamp: 1000,
  };

  const resetStore = () => {
    useWorkoutSessionStore.setState({
      status: 'idle',
      reconnecting: false,
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      stoppedElapsedMs: null,
      samples: [],
    });
  };

  beforeEach(() => {
    resetStore();
    currentTime = 100000;
    dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => currentTime);
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  describe('start', () => {
    it('starts a fresh session from idle', () => {
      useWorkoutSessionStore.getState().start();
      const state = useWorkoutSessionStore.getState();

      expect(state.status).toBe('active');
      expect(state.startedAt).toBe(100000);
      expect(state.reconnecting).toBe(false);
      expect(state.totalPausedMs).toBe(0);
      expect(state.stoppedElapsedMs).toBeNull();
      expect(state.samples).toEqual([]);
    });

    it('starts a fresh session from stopped and resets previous session data', () => {
      // Set up a stopped state with data
      useWorkoutSessionStore.setState({
        status: 'stopped',
        reconnecting: true,
        startedAt: 50000,
        pausedAt: null,
        totalPausedMs: 5000,
        stoppedElapsedMs: 45000,
        samples: [mockSample],
      });

      currentTime = 200000;
      useWorkoutSessionStore.getState().start();
      const state = useWorkoutSessionStore.getState();

      expect(state.status).toBe('active');
      expect(state.startedAt).toBe(200000);
      expect(state.reconnecting).toBe(false);
      expect(state.totalPausedMs).toBe(0);
      expect(state.stoppedElapsedMs).toBeNull();
      expect(state.samples).toEqual([]);
    });

    it('no-ops when active or paused', () => {
      useWorkoutSessionStore.getState().start();
      expect(useWorkoutSessionStore.getState().status).toBe('active');

      // Calling start again while active
      currentTime = 150000;
      useWorkoutSessionStore.getState().start();
      expect(useWorkoutSessionStore.getState().startedAt).toBe(100000);

      // Pause and call start
      useWorkoutSessionStore.getState().pause();
      expect(useWorkoutSessionStore.getState().status).toBe('paused');
      useWorkoutSessionStore.getState().start();
      expect(useWorkoutSessionStore.getState().status).toBe('paused');
    });
  });

  describe('pause and resume', () => {
    it('pauses from active and resumes to active, adding pause span to totalPausedMs', () => {
      useWorkoutSessionStore.getState().start(); // startedAt = 100000

      currentTime = 130000; // 30s active
      useWorkoutSessionStore.getState().pause();
      const pausedState = useWorkoutSessionStore.getState();
      expect(pausedState.status).toBe('paused');
      expect(pausedState.pausedAt).toBe(130000);

      currentTime = 160000; // paused for 30s
      useWorkoutSessionStore.getState().resume();
      const resumedState = useWorkoutSessionStore.getState();
      expect(resumedState.status).toBe('active');
      expect(resumedState.pausedAt).toBeNull();
      expect(resumedState.totalPausedMs).toBe(30000);

      currentTime = 170000; // another 10s active
      expect(useWorkoutSessionStore.getState().getElapsedMs()).toBe(40000); // 30s + 10s
    });

    it('no-ops pause from idle, paused, or stopped', () => {
      // From idle
      useWorkoutSessionStore.getState().pause();
      expect(useWorkoutSessionStore.getState().status).toBe('idle');

      // From paused
      useWorkoutSessionStore.getState().start();
      useWorkoutSessionStore.getState().pause();
      expect(useWorkoutSessionStore.getState().status).toBe('paused');
      const pausedAt = useWorkoutSessionStore.getState().pausedAt;

      currentTime = 120000;
      useWorkoutSessionStore.getState().pause();
      expect(useWorkoutSessionStore.getState().pausedAt).toBe(pausedAt);

      // From stopped
      useWorkoutSessionStore.getState().stop();
      expect(useWorkoutSessionStore.getState().status).toBe('stopped');
      useWorkoutSessionStore.getState().pause();
      expect(useWorkoutSessionStore.getState().status).toBe('stopped');
    });

    it('no-ops resume from idle, active, or stopped', () => {
      // From idle
      useWorkoutSessionStore.getState().resume();
      expect(useWorkoutSessionStore.getState().status).toBe('idle');

      // From active
      useWorkoutSessionStore.getState().start();
      useWorkoutSessionStore.getState().resume();
      expect(useWorkoutSessionStore.getState().status).toBe('active');

      // From stopped
      useWorkoutSessionStore.getState().stop();
      useWorkoutSessionStore.getState().resume();
      expect(useWorkoutSessionStore.getState().status).toBe('stopped');
    });
  });

  describe('stop', () => {
    it('freezes stoppedElapsedMs when stopped from active', () => {
      useWorkoutSessionStore.getState().start(); // startedAt = 100000
      currentTime = 145000; // 45s active

      useWorkoutSessionStore.getState().stop();
      const state = useWorkoutSessionStore.getState();

      expect(state.status).toBe('stopped');
      expect(state.stoppedElapsedMs).toBe(45000);
      expect(state.getElapsedMs()).toBe(45000);

      // Advancing time later does not change getElapsedMs
      currentTime = 200000;
      expect(state.getElapsedMs()).toBe(45000);
    });

    it('freezes stoppedElapsedMs when stopped from paused', () => {
      useWorkoutSessionStore.getState().start(); // startedAt = 100000
      currentTime = 145000; // 45s active
      useWorkoutSessionStore.getState().pause(); // pausedAt = 145000

      currentTime = 200000; // inside pause
      useWorkoutSessionStore.getState().stop();
      const state = useWorkoutSessionStore.getState();

      expect(state.status).toBe('stopped');
      expect(state.stoppedElapsedMs).toBe(45000);
    });

    it('no-ops stop from idle or stopped', () => {
      useWorkoutSessionStore.getState().stop();
      expect(useWorkoutSessionStore.getState().status).toBe('idle');

      useWorkoutSessionStore.getState().start();
      useWorkoutSessionStore.getState().stop();
      expect(useWorkoutSessionStore.getState().status).toBe('stopped');

      useWorkoutSessionStore.getState().stop();
      expect(useWorkoutSessionStore.getState().status).toBe('stopped');
    });
  });

  describe('addSample', () => {
    it('appends sample only while active', () => {
      useWorkoutSessionStore.getState().start();
      useWorkoutSessionStore.getState().addSample(mockSample);

      expect(useWorkoutSessionStore.getState().samples).toEqual([mockSample]);
    });

    it('silently drops samples when idle, paused, or stopped', () => {
      // Idle
      useWorkoutSessionStore.getState().addSample(mockSample);
      expect(useWorkoutSessionStore.getState().samples).toEqual([]);

      // Paused
      useWorkoutSessionStore.getState().start();
      useWorkoutSessionStore.getState().addSample(mockSample);
      useWorkoutSessionStore.getState().pause();
      useWorkoutSessionStore.getState().addSample({ ...mockSample, bpm: 130 });
      expect(useWorkoutSessionStore.getState().samples).toHaveLength(1);

      // Stopped
      useWorkoutSessionStore.getState().stop();
      useWorkoutSessionStore.getState().addSample({ ...mockSample, bpm: 140 });
      expect(useWorkoutSessionStore.getState().samples).toHaveLength(1);
    });
  });

  describe('setReconnecting', () => {
    it('sets reconnecting flag while active or paused', () => {
      useWorkoutSessionStore.getState().start();
      useWorkoutSessionStore.getState().setReconnecting(true);
      expect(useWorkoutSessionStore.getState().reconnecting).toBe(true);

      useWorkoutSessionStore.getState().pause();
      useWorkoutSessionStore.getState().setReconnecting(false);
      expect(useWorkoutSessionStore.getState().reconnecting).toBe(false);
    });

    it('no-ops setReconnecting while idle or stopped', () => {
      useWorkoutSessionStore.getState().setReconnecting(true);
      expect(useWorkoutSessionStore.getState().reconnecting).toBe(false);

      useWorkoutSessionStore.getState().start();
      useWorkoutSessionStore.getState().stop();
      useWorkoutSessionStore.getState().setReconnecting(true);
      expect(useWorkoutSessionStore.getState().reconnecting).toBe(false);
    });
  });

  describe('disconnect scenarios', () => {
    it('handles disconnect-during-active: reconnecting flag is set, status remains active, timer runs, and stop works', () => {
      useWorkoutSessionStore.getState().start(); // startedAt = 100000
      currentTime = 110000;

      // Disconnect occurs
      useWorkoutSessionStore.getState().setReconnecting(true);
      const stateDuringDrop = useWorkoutSessionStore.getState();
      expect(stateDuringDrop.status).toBe('active');
      expect(stateDuringDrop.reconnecting).toBe(true);

      // Samples dropped during disconnect simulation (no addSample calls or dropped)
      currentTime = 130000;
      expect(useWorkoutSessionStore.getState().getElapsedMs()).toBe(30000);

      // Stop works normally afterward
      useWorkoutSessionStore.getState().stop();
      expect(useWorkoutSessionStore.getState().status).toBe('stopped');
      expect(useWorkoutSessionStore.getState().stoppedElapsedMs).toBe(30000);
    });

    it('handles pause-during-disconnect: composition of pause and reconnecting', () => {
      useWorkoutSessionStore.getState().start(); // 100000
      currentTime = 110000; // 10s active
      useWorkoutSessionStore.getState().pause(); // pausedAt = 110000

      // Reconnect flag set while paused
      useWorkoutSessionStore.getState().setReconnecting(true);
      expect(useWorkoutSessionStore.getState().reconnecting).toBe(true);

      currentTime = 140000; // 30s paused span
      useWorkoutSessionStore.getState().resume();
      expect(useWorkoutSessionStore.getState().totalPausedMs).toBe(30000);

      currentTime = 150000; // another 10s active
      expect(useWorkoutSessionStore.getState().getElapsedMs()).toBe(20000); // 10s + 10s
    });
  });
});
