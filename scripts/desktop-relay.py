"""Temporary KWin-to-parent relay. No configuration or desktop files are written."""
import json
import math
import signal
import sys
import dbus
import dbus.service
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib

DBusGMainLoop(set_as_default=True)
service_name, token = sys.argv[1:3]
bus = dbus.SessionBus()
loop = GLib.MainLoop()
name = dbus.service.BusName(service_name, bus=bus, do_not_queue=True)
pending_geometry = {}
pending_timers = {}

def emit(value):
    print(json.dumps(value), flush=True)

class Relay(dbus.service.Object):
    def trusted(self, sender, secret):
        if str(secret) != token or sender != bus.get_name_owner('org.kde.KWin'):
            raise dbus.exceptions.DBusException('Untrusted compositor sender')

    @dbus.service.method('org.local.CompanionDesktop', in_signature='sdddds', out_signature='', sender_keyword='sender')
    def Geometry(self, title, x, y, width, height, secret, sender=None):
        self.trusted(sender, secret)
        values = [float(v) for v in (x, y, width, height)]
        if len(str(title)) > 512 or not all(math.isfinite(v) and abs(v) < 100000 for v in values) or width <= 0 or height <= 0:
            return
        key = str(title)
        pending_geometry[key] = dict(type='geometry', title=key, x=values[0], y=values[1], width=values[2], height=values[3])
        if key in pending_timers:
            GLib.source_remove(pending_timers[key])
        def deliver():
            pending_timers.pop(key, None)
            emit(pending_geometry.pop(key))
            return False
        pending_timers[key] = GLib.timeout_add(120, deliver)

    @dbus.service.method('org.local.CompanionDesktop', in_signature='sdddds', out_signature='', sender_keyword='sender')
    def Pointer(self, title, x, y, nx, ny, secret, sender=None):
        self.trusted(sender, secret)
        if len(str(title)) <= 512 and all(math.isfinite(float(v)) and abs(v) < 100000 for v in (x, y, nx, ny)):
            emit(dict(type='pointer', title=str(title), x=float(x), y=float(y), nx=max(-1.0, min(1.0, float(nx))), ny=max(-1.0, min(1.0, float(ny)))))

relay = Relay(bus, '/CompanionDesktop')
signal.signal(signal.SIGTERM, lambda *_: loop.quit())
signal.signal(signal.SIGINT, lambda *_: loop.quit())
GLib.io_add_watch(sys.stdin, GLib.IO_HUP, lambda *_: (loop.quit(), False)[1])
emit(dict(type='ready'))
loop.run()
