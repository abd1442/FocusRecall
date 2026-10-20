// Small Node-API binding. No hooks, injection, child processes or persistent
// handles. Windows queries run only when the consenting main process calls read.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#define _WIN32_WINNT 0x0600
#include <windows.h>
#include <node_api.h>
#include <string>
#include <delayimp.h>

// Resolve Node-API exports from the current host (including a renamed packaged
// Electron executable), never by searching for a node.exe beside/on PATH.
static FARPROC WINAPI BindHost(unsigned int event, DelayLoadInfo* info) {
  if (event == dliNotePreLoadLibrary && _stricmp(info->szDll, "node.exe") == 0)
    return reinterpret_cast<FARPROC>(GetModuleHandleW(nullptr));
  return nullptr;
}
decltype(__pfnDliNotifyHook2) __pfnDliNotifyHook2 = BindHost;

static napi_value Empty(napi_env env) {
  napi_value value;
  napi_get_null(env, &value);
  return value;
}
static void Text(napi_env env, napi_value object, const char* key, const std::wstring& text) {
  napi_value value;
  napi_create_string_utf16(env, reinterpret_cast<const char16_t*>(text.data()), text.size(), &value);
  napi_set_named_property(env, object, key, value);
}
static napi_value Read(napi_env env, napi_callback_info info) {
  size_t count = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
  bool titles = false;
  if (count >= 1) napi_get_value_bool(env, args[0], &titles);
  // Verification can constrain reads to its own fictional window before any
  // process-name/title query. Production supplies no PID filter.
  uint32_t expectedPid = 0;
  if (count >= 2) napi_get_value_uint32(env, args[1], &expectedPid);
  HWND window = GetForegroundWindow();
  if (!window) return Empty(env);
  DWORD pid = 0;
  GetWindowThreadProcessId(window, &pid);
  if (!pid || (expectedPid && pid != expectedPid)) return Empty(env);
  // Avoid sending WM_GETTEXT to our own UI thread, and never read our titles.
  std::wstring name;
  std::wstring title;
  if (pid == GetCurrentProcessId()) {
    name = L"FocusRecall";
  } else {
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
    if (!process) return Empty(env); // Restricted/elevated/protected processes: no guessing.
    wchar_t image[32768];
    DWORD length = static_cast<DWORD>(sizeof(image) / sizeof(image[0]));
    BOOL ok = QueryFullProcessImageNameW(process, 0, image, &length);
    CloseHandle(process);
    if (!ok) return Empty(env);
    std::wstring path(image, length);
    const size_t slash = path.find_last_of(L"\\/");
    name = path.substr(slash == std::wstring::npos ? 0 : slash + 1);
    if (name.size() > 4 && _wcsicmp(name.c_str() + name.size() - 4, L".exe") == 0) name.resize(name.size() - 4);
    if (name.empty()) return Empty(env);
    if (titles) {
      wchar_t caption[1024];
      const int n = GetWindowTextW(window, caption, 1024);
      if (n > 0) title.assign(caption, n);
    }
  }
  // Do not pair a process with a title from a window which changed mid-query.
  DWORD stillPid = 0;
  if (GetForegroundWindow() != window || !GetWindowThreadProcessId(window, &stillPid) || stillPid != pid) return Empty(env);
  napi_value result, id;
  napi_create_object(env, &result);
  napi_create_uint32(env, pid, &id);
  napi_set_named_property(env, result, "pid", id);
  Text(env, result, "process", name);
  Text(env, result, "title", title);
  return result;
}
NAPI_MODULE_INIT() {
  napi_value read;
  napi_create_function(env, "read", NAPI_AUTO_LENGTH, Read, nullptr, &read);
  napi_set_named_property(env, exports, "read", read);
  return exports;
}
