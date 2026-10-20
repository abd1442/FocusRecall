# Fictional protocol fixture on a private session bus. This is NOT a real OS lock.
from gi.repository import Gio, GLib
active = False
name = 'org.gnome.Shell.ScreenShield'
iface = 'org.gnome.ScreenSaver'
path = '/org/gnome/ScreenSaver'
xml = '<node><interface name="org.gnome.ScreenSaver"><method name="GetActive"><arg type="b" direction="out"/></method><method name="FixtureSet"><arg type="b" direction="in"/></method><signal name="ActiveChanged"><arg type="b"/></signal></interface></node>'
bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
def method(connection, sender, object_path, interface, method, params, invocation):
    global active
    if method == 'GetActive':
        invocation.return_value(GLib.Variant('(b)', (active,)))
    elif method == 'FixtureSet':
        active = params.unpack()[0]
        connection.emit_signal(None, path, iface, 'ActiveChanged', GLib.Variant('(b)', (active,)))
        invocation.return_value(GLib.Variant('()', ()))
bus.register_object(path, Gio.DBusNodeInfo.new_for_xml(xml).interfaces[0], method, None, None)
Gio.bus_own_name_on_connection(bus, name, Gio.BusNameOwnerFlags.NONE, None, None)
GLib.MainLoop().run()
