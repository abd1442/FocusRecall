# Optional Windows foreground binding

Built from `foreground.cc` by `npm run build:foreground` (also part of `npm run build`).
Requires MSVC x64 build tools, Windows SDK and cached Node headers/import library.
Set `FOCUSRECALL_NODE_HEADERS` to that version directory if the normal node-gyp
cache is elsewhere. The build never downloads anything. It produces an ignored
`resources/native/win32-x64/foreground.node`; electron-builder unpacks it under
`app.asar.unpacked/resources/native/win32-x64`. Node-API 8 and a static CRT avoid
an additional runtime or npm dependency. The delay-load hook resolves Node-API
from the running host, including the renamed FocusRecall executable, not PATH.
The current Windows distribution is x64; unsupported platforms fail closed.

`read(titles)` gets the foreground HWND/PID, opens only that process with limited
query rights, obtains its executable basename and closes the handle immediately.
There is no process-name cache (PIDs may be reused). Full paths stay inside the
call and are never returned. `GetWindowTextW` is reached only for an explicit
`true` title flag and never for the host process. Strings are bounded; a changed
window/PID or inaccessible process returns null. No other window enumeration,
input hooks, injected code, screenshots, browser URLs, network or filesystem I/O.
The main process additionally excludes all app-owned Electron windows and strips
titles again before persistence in app-name mode.

The watcher is lazy and runs one unreferenced two-second timer only during an
eligible, consented context. It stops on pause, Recall/logging, rest completion,
recovery, opt-out and shutdown. No helper can outlive a crash because none is
launched. Exceptions stop polling; inaccessible windows leave gaps. The last
failure stays visible in Settings after the session; a successful retry clears it.

QA: `node scripts/build-foreground.cjs --fixture` also builds a **non-shipped**
fictional window in `out/native-foreground`. `verify-tracking-native.cjs` wraps
its isolated app's reader with `read(titles, expectedPid)`; the optional second
argument refuses other windows before any process-name or title query. This
prevents verification from recording the owner's foreground activity. The QA-only window temporarily attaches/detaches input queues to activate itself;
it does not read keyboard state. This code is never linked into the production
binding. Production supplies no PID filter. The QA window closes after five minutes even if its
orchestrator crashes. Normal tests close it immediately when finished.

Windows API behavior: [foreground window](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow),
[caption retrieval](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextw),
[limited process query](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew).
See [Node-API](https://nodejs.org/api/n-api.html) and
[Electron native-module guidance](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).
This design removes the old encoded PowerShell/runtime compiler mechanism; it
does not certify antivirus, EDR, SmartScreen or enterprise policy compatibility.
