# VENUE SOUND CONSOLE ARCHITECTURE

## 1. Overview & Operational Role
In live college auditorium competitions, venue audio is typically driven by an AV technician or operator stationed at an audio mixing console with a dedicated laptop plugged into venue PA speakers.

The system provides a dedicated **Venue Sound Console** interface accessible via:
```
http://localhost:3000/?role=sound&pass=sound2026
```
(or via LAN `http://<SERVER_IP>:3000/?role=sound&pass=sound2026`)

---

## 2. Security & Role Isolation Invariant
- **Client Privilege Isolation**: The Sound Console client has strictly read-only display permissions and sound cue consumption privileges.
- **Forbidden Actions**: The Sound Console cannot issue host commands, alter market prices, pause/resume trading, modify team rosters, or submit orders.
- **Server Role Enforcement**: Every WebSocket message sent to the server is authenticated; any attempt to dispatch administrative commands from a `SOUND` session is rejected with `403 Forbidden`.

---

## 3. Web Audio API Institutional Synthesizer (Zero-CDN Offline Invariant)
To operate in zero-connectivity college environments, the platform synthesizes all audio cues locally using the browser's native **Web Audio API**:
- **Dual-Chime Bell (880Hz & 1320Hz)**: Used for market open, resume countdown 3-2-1, and audio self-test.
- **Harmonic Chord Synthesis**: Used for market close and circuit breaker halts.
- **Tension Drum Rolls & Trumpet Fanfares**: Synthesized for the Grand Finale Winner Presentation reveals (3rd place, 2nd place, 1st place champion).
- **Zero MP3 / Zero Cloud Audio**: No external audio files are loaded over the internet; audio synthesis functions with 100% offline reliability.

---

## 4. Audio Cue Delivery & Deduplication Protocol
- Every audio command broadcast by the server includes a unique UUID/timestamp (`cue_id`).
- The client-side audio engine maintains a cache of executed `cue_id` values within a 5-second window.
- Duplicate WebSocket deliveries or socket reconnect bursts are automatically dropped, preventing echoed or double sounds.

---

## 5. Host Audio Self-Test Feature
The Host Control Centre includes a 1-click **Audio Self-Test** button (`#hostBtnAudioSelfTest`):
1. **Local Audio**: Plays a chime locally in the host's browser to confirm browser audio unlock.
2. **Remote Broadcast**: Dispatches `HOST_PLAY_SOUND` with `cue: "TEST_CHIME"` to all connected Venue Sound Console instances.
3. **Operator Feedback**: The Sound Console displays the incoming test cue in its playback log, allowing the AV operator to balance gain and master levels before the audience arrives.
