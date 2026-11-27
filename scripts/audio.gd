extends Node
## Музыка и звуковые эффекты с раздельной громкостью (шины Music и SFX).

const SOUNDS := ["squeak", "coin", "click", "pop", "chime", "water", "crunch", "call", "shutter", "sparkle", "swish"]
var streams := {}
var players: Array[AudioStreamPlayer] = []
var music: AudioStreamPlayer
var _idx := 0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for bus in ["Music", "SFX"]:
		if AudioServer.get_bus_index(bus) < 0:
			AudioServer.add_bus()
			AudioServer.set_bus_name(AudioServer.bus_count - 1, bus)
			AudioServer.set_bus_send(AudioServer.bus_count - 1, "Master")
	for s in SOUNDS:
		var st = load("res://assets/audio/%s.wav" % s)
		if st:
			streams[s] = st
	for i in 6:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		players.append(p)
	music = AudioStreamPlayer.new()
	music.bus = "Music"
	var ms = load("res://assets/audio/music_loop.wav")
	if ms is AudioStreamWAV:
		ms.loop_mode = AudioStreamWAV.LOOP_FORWARD
		ms.loop_begin = 0
		ms.loop_end = int(ms.get_length() * ms.mix_rate)
	music.stream = ms
	add_child(music)
	Game.apply_settings()
	music.volume_db = -4.0
	music.play()

func play(name: String, pitch := 1.0) -> void:
	if not streams.has(name):
		return
	var p := players[_idx]
	_idx = (_idx + 1) % players.size()
	p.stream = streams[name]
	p.pitch_scale = pitch
	p.play()
