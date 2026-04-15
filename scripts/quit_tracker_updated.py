# Quit tracker - deteccion y avisos de quits en partidas activas

import minqlx
import time
import threading
import requests
from datetime import datetime, timezone

from .quakeclub_utils import QUAKECLUB_API_URL, API_TIMEOUT, clean_colors


class quit_tracker(minqlx.Plugin):
    def __init__(self):
        self.set_cvar_once("qlx_quakeclubApiKey", "")
        self.set_cvar_once("qlx_quitThreshold", "5")
        self.set_cvar_once("qlx_quitWindowDays", "7")
        self.set_cvar_once("qlx_quitReconnectGrace", "90")

        self.add_hook("player_disconnect", self.handle_player_disconnect)
        self.add_hook("player_connect", self.handle_player_connect)
        self.add_hook("game_start", self.handle_game_start)

        self.add_command(("quitstatus", "qs"), self.cmd_quitstatus, 0, usage="[id]")

        self._recent_disconnects = {}
        # steam_ids kickeados por admin (exentos)
        self._kicked_by_admin = set()
        # Trackear ultimo equipo activo (red/blue) para detectar evasion por spec
        self._last_active_team = {}
        self._lock = threading.RLock()

    def handle_game_start(self, game):
        with self._lock:
            self._kicked_by_admin.clear()
            self._last_active_team.clear()
            # Registrar equipos iniciales de todos los jugadores
            for p in self.players():
                if p.team in ("red", "blue"):
                    self._last_active_team[str(p.steam_id)] = p.team

    def handle_player_disconnect(self, player, reason):
        try:
            game = self.game
            if not game or game.state != "in_progress":
                return

            steam_id = str(player.steam_id)
            player_name = clean_colors(player.name)

            # FIX: Detectar evasion por spec - usar ultimo equipo activo
            # Si el jugador esta en spec pero estuvo en red/blue durante este match,
            # sigue siendo un quit
            was_active = False
            with self._lock:
                if player.team in ("red", "blue"):
                    was_active = True
                elif steam_id in self._last_active_team:
                    was_active = True

            if not was_active:
                return

            # Exentos: kickeados por admin
            with self._lock:
                if steam_id in self._kicked_by_admin:
                    self._kicked_by_admin.discard(steam_id)
                    return

            # Razones que no son quit voluntario
            reason_lower = (reason or "").lower()
            if any(r in reason_lower for r in ("kicked", "banned", "timed out")):
                return

            # Registrar para ventana de reconexion
            with self._lock:
                self._recent_disconnects[steam_id] = {
                    "time": time.time(),
                    "name": player_name,
                }

            # FIX: Esperar el grace period ANTES de emitir la advertencia
            # Si el jugador vuelve dentro del grace, se cancela
            grace = self.get_cvar("qlx_quitReconnectGrace", int) or 90
            threshold = self.get_cvar("qlx_quitThreshold", int) or 5
            t = threading.Thread(
                target=self._delayed_quit_warning,
                args=(steam_id, player_name, threshold, grace),
                daemon=True
            )
            t.start()

        except Exception as e:
            minqlx.console_print("[quit_tracker] handle_player_disconnect error: {}".format(e))

    def handle_player_connect(self, player):
        steam_id = str(player.steam_id)

        with self._lock:
            disconnect_info = self._recent_disconnects.pop(steam_id, None)

        grace = self.get_cvar("qlx_quitReconnectGrace", int) or 90

        # Si reconecto dentro del grace period, el quit ya fue cancelado (pop arriba)
        if disconnect_info and (time.time() - disconnect_info["time"]) <= grace:
            self._tell_frame(player, "^3[QuitTracker]^7 ^2Reconexion detectada, quit cancelado.")
            return

        # Mostrar advertencia si tiene quits activos
        threshold = self.get_cvar("qlx_quitThreshold", int) or 5
        t = threading.Thread(
            target=self._show_connect_warning,
            args=(player, threshold),
            daemon=True
        )
        t.start()

    def _delayed_quit_warning(self, steam_id, player_name, threshold, grace):
        """Espera el grace period y solo emite la advertencia si el jugador no volvio."""
        time.sleep(grace)

        # Verificar si el jugador reconecto durante el grace period
        with self._lock:
            disconnect_info = self._recent_disconnects.pop(steam_id, None)

        # Si ya fue removido por handle_player_connect, el jugador volvio - no hacer nada
        if disconnect_info is None:
            return

        # El jugador NO volvio - procesar quit
        count = self._get_active_quits(steam_id)
        if count is None:
            return
        # El quit nuevo aun no fue procesado por el backend (stats del match),
        # anticipamos +1 para mostrar la advertencia correcta
        anticipated = count + 1
        self._emit_warning(steam_id, player_name, anticipated, threshold)

    def _show_connect_warning(self, player, threshold):
        """Al conectarse, muestra resumen si tiene quits activos."""
        count = self._get_active_quits(str(player.steam_id))
        if count is None or count == 0:
            return
        window = self.get_cvar("qlx_quitWindowDays", int) or 7
        msg = self._build_status_msg(count, threshold, window, next_expiry=None)
        self._tell_frame(player, "^3[QuitTracker]^7 " + msg)

    @minqlx.next_frame
    def _emit_warning(self, steam_id, player_name, count, threshold):
        player = self._find_player(steam_id)

        if count == 1:
            msg = "^3Quit registrado (^11/{}^3). Acumular {} quits en 7 dias = ^1-150 ELO^3.".format(threshold, threshold)
            if player:
                player.tell("^3[QuitTracker]^7 " + msg)

        elif count == 2:
            msg = "^3Quit registrado (^32/{}^3).".format(threshold)
            if player:
                player.tell("^3[QuitTracker]^7 " + msg)

        elif count == 3:
            self.msg("^3[QuitTracker]^7 ^3{}^7 lleva ^33^7 quits esta semana.".format(player_name))
            if player:
                player.tell("^3[QuitTracker]^7 Quit registrado (3/{}).".format(threshold))

        elif count == 4:
            self.msg("^3[QuitTracker]^7 ^3{}^7 lleva ^34^7 quits. ^1Uno mas = -150 ELO^7.".format(player_name))
            if player:
                player.tell("^3[QuitTracker]^7 ^1ATENCION: Un quit mas y perderas 150 ELO.")

        elif count >= threshold:
            self.msg("^3[QuitTracker]^7 ^1{}^7 ha alcanzado ^1{}^7 quits. ^1Penalizacion de -150 ELO aplicada.".format(
                player_name, threshold))
            if player:
                player.tell("^3[QuitTracker]^7 ^1Has alcanzado {} quits. Penalizacion de -150 ELO aplicada automaticamente.".format(threshold))

    def cmd_quitstatus(self, player, msg, channel):
        if len(msg) > 1:
            if self.db.get_permission(player) < 2:
                player.tell("^1No tienes permisos para consultar el estado de otros jugadores.")
                return minqlx.RET_STOP_ALL
            target = self._resolve_player(msg[1])
            if not target:
                player.tell("^1Jugador no encontrado: ^7{}".format(msg[1]))
                return minqlx.RET_STOP_ALL
            steam_id = str(target.steam_id)
            name = clean_colors(target.name)
        else:
            steam_id = str(player.steam_id)
            name = clean_colors(player.name)

        threshold = self.get_cvar("qlx_quitThreshold", int) or 5
        window = self.get_cvar("qlx_quitWindowDays", int) or 7

        t = threading.Thread(
            target=self._send_quitstatus,
            args=(player, steam_id, name, threshold, window),
            daemon=True
        )
        t.start()
        return minqlx.RET_STOP_ALL

    def _send_quitstatus(self, requester, steam_id, name, threshold, window):
        try:
            url = "{}/internal/quit-status/{}".format(QUAKECLUB_API_URL, steam_id)
            resp = requests.get(url, headers={"x-api-key": self.get_cvar("qlx_quakeclubApiKey") or ""}, timeout=API_TIMEOUT)
            if resp.status_code != 200:
                self._tell_frame(requester, "^1[QuitTracker] Error consultando estado.")
                return

            data = resp.json()
            count = data.get("activeQuits", 0)
            next_expiry_raw = data.get("nextExpiry")

            next_expiry = None
            if next_expiry_raw:
                try:
                    next_expiry = datetime.fromisoformat(next_expiry_raw.replace("Z", "+00:00"))
                except Exception:
                    pass

            header = "^7[^3{}^7] ".format(name) if steam_id != str(requester.steam_id) else ""
            msg = self._build_status_msg(count, threshold, window, next_expiry)
            self._tell_frame(requester, "^3[QuitTracker]^7 {}{}".format(header, msg))

        except Exception as e:
            minqlx.console_print("[quit_tracker] _send_quitstatus error: {}".format(e))

    def _get_active_quits(self, steam_id):
        try:
            url = "{}/internal/quit-status/{}".format(QUAKECLUB_API_URL, steam_id)
            resp = requests.get(url, headers={"x-api-key": self.get_cvar("qlx_quakeclubApiKey") or ""}, timeout=API_TIMEOUT)
            if resp.status_code == 200:
                return resp.json().get("activeQuits", 0)
        except Exception as e:
            minqlx.console_print("[quit_tracker] _get_active_quits error: {}".format(e))
        return None

    def _build_status_msg(self, count, threshold, window, next_expiry):
        if count == 0:
            estado = "^2LIMPIO"
        elif count <= 2:
            estado = "^2LIMPIO"
        elif count <= 3:
            estado = "^3ADVERTENCIA"
        elif count == threshold - 1:
            estado = "^1EN RIESGO"
        elif count >= threshold:
            estado = "^1PENALIZADO"
        else:
            estado = "^3ADVERTENCIA"

        expiry_str = ""
        if next_expiry:
            now = datetime.now(timezone.utc)
            delta = next_expiry - now
            total_seconds = int(delta.total_seconds())
            if total_seconds > 0:
                days = total_seconds // 86400
                hours = (total_seconds % 86400) // 3600
                expiry_str = " | ^7Proximo expira: ^3{}d {}h^7".format(days, hours)

        return "Quits activos: ^3{}/{}^7 | Estado: {}^7{}".format(count, threshold, estado, expiry_str)

    def _find_player(self, steam_id):
        for p in self.players():
            if str(p.steam_id) == steam_id:
                return p
        return None

    def _resolve_player(self, ident):
        try:
            sid = int(ident)
            for p in self.players():
                if p.id == sid or p.steam_id == sid:
                    return p
        except ValueError:
            name_lower = ident.lower()
            for p in self.players():
                if name_lower in clean_colors(p.name).lower():
                    return p
        return None

    @minqlx.next_frame
    def _tell_frame(self, player, msg):
        try:
            player.tell(msg)
        except Exception:
            pass

    def mark_kicked_by_admin(self, steam_id):
        """Otros plugins pueden llamar esto antes de kickear para eximir del conteo."""
        with self._lock:
            self._kicked_by_admin.add(str(steam_id))
